# Persistence Model

> How SportsOS stores the Sprint 4 slice of data. Applies to Person, Sports ID,
> AthleteProfile, AthleteSportParticipation, and minimal Sport reference data.
> Introduced in architecture v0.6.0 (Sprint 4). See ADR-020 (adapter), ADR-021
> (versioning), ADR-022 (migration discipline), and `operations/database.md`.

## Where persistence lives

Persistence is an adapter concern. The Domain and Application layers know only
the context-specific repository contracts (`PersonRepository`,
`AthleteProfileRepository`, `SportDirectory`); they never import a database
driver. All PostgreSQL code lives under `src/adapters/persistence/pg/`:

| File | Responsibility |
|---|---|
| `connection.ts` | The ONLY place a connection is built and the ONLY reader of database env vars. |
| `errors.ts` | Translates driver failures (unique / foreign-key violations) into typed outcomes. |
| `mappers.ts` | Explicit row ↔ domain mapping; no row type reaches the domain. |
| `pg-person-repository.ts` | `PersonRepository` backed by PostgreSQL. |
| `pg-athlete-profile-repository.ts` | `AthleteProfileRepository` backed by PostgreSQL. |
| `pg-sport-directory.ts` | `SportDirectory` existence check over the `sports` table. |

The driver is `postgres` (porsager), used directly — no ORM, no generic CRUD
abstraction, and not the Supabase JS SDK. Confining it to this directory keeps
`domain-no-external-sdk` and `app-no-external-sdk` green.

## Tables

Only the Sprint 4 slice is persisted. There are NO organization, tenant, event,
registration, payment, rewards, QR, or authorization tables.

### `persons` — platform-global personal identity

`id (text, PK)`, `display_name (text, NOT NULL, non-blank)`,
`date_of_birth (date, nullable)`, `lifecycle_status (text, CHECK active |
deactivated | archived | anonymized)`, `version (int, DEFAULT 1, CHECK >= 1)`,
`created_at (timestamptz, DEFAULT now())`.

- **Platform-global** — no `tenantId`.
- **Date of birth is private.** It is never exposed by the public lookup paths
  and never copied into athlete rows or events. Mappers select it only for the
  owning Person.

### `sports_ids` — the public Sports ID, 1:1 with a Person

`value (text, PK)`, `person_id (text, NOT NULL, UNIQUE, FK → persons.id)`,
`issued_at (timestamptz, NOT NULL)`, `status (text, CHECK active | revoked)`.

- The primary key on `value` makes the **public Sports ID globally unique** and
  ensures one Sports ID cannot be shared by two people.
- The `UNIQUE (person_id)` enforces **at most one Sports ID per Person**.
- The Sports ID is distinct from the Person ID and encodes no personal data.
  There is no QR credential here.

### `athlete_profiles` — optional athletic identity, at most one per Person

`id (text, PK)`, `person_id (text, NOT NULL, UNIQUE, FK → persons.id)`,
`status (text, CHECK active | inactive)`, `version (int, DEFAULT 1, CHECK >= 1)`,
`created_at (timestamptz, NOT NULL)`.

- Primary key → unique profile ID; `UNIQUE (person_id)` → **one profile per
  Person**.
- Person-owned and sport-independent. It duplicates no Person name, date of
  birth, or Sports ID.

### `athlete_sport_participations` — multi-sport history with re-entry

`id (text, PK)`, `athlete_profile_id (text, NOT NULL, FK → athlete_profiles.id)`,
`sport_id (text, NOT NULL, FK → sports.id)`,
`status (text, CHECK active | ended)`, `started_at (timestamptz, NOT NULL)`,
`ended_at (timestamptz, nullable)`.

- There is **no permanent uniqueness** on `(athlete_profile_id, sport_id)`.
- A **partial unique index** enforces **at most one ACTIVE participation** per
  athlete/sport:

  ```
  CREATE UNIQUE INDEX uq_active_participation_per_sport
    ON athlete_sport_participations (athlete_profile_id, sport_id)
    WHERE status = 'active';
  ```

- This preserves `startedAt`/`endedAt`/`status` history and allows an athlete to
  leave a sport (`status = 'ended'`, `ended_at` set) and later **return** to the
  same sport with a new active row. Ended records are never silently overwritten.

### `sports` — minimal platform reference data

`id (text, PK)`, `code (text, UNIQUE)`, `name (text)`,
`created_at (timestamptz, DEFAULT now())`.

Platform reference data, not tenant-owned. A minimal deterministic seed exists
(see `operations/database.md`); it is not an exhaustive catalog and no business
logic is hard-coded around specific seed rows. There is no catalog CRUD or UI.

## Transaction and conflict semantics

### Person + Sports ID (atomic)

`PgPersonRepository.create` runs both inserts in one transaction
(`sql.begin`). Either both rows commit or neither does — a Person can never exist
without its Sports ID, nor a Sports ID without its Person. Database uniqueness is
the final guard behind the use case's own collision pre-check; conflicts are
translated to typed outcomes:

| Database violation | Typed outcome |
|---|---|
| `persons_pkey` | `duplicate_person_id` |
| `sports_ids_pkey` (public value) | `duplicate_sports_id` |
| `sports_ids_person_id_key` (one per Person) | `duplicate_sports_id` |

### AthleteProfile and participation (final guard under concurrency)

The database is the last line of defence for the one-profile-per-person and
one-active-period-per-athlete/sport invariants, so they hold even under
concurrent requests that both pass the application pre-check:

| Database violation | Typed outcome |
|---|---|
| `athlete_profiles_pkey` | `duplicate_athlete_profile_id` |
| `athlete_profiles_person_id_key` | `person_already_has_profile` |
| `uq_active_participation_per_sport` | `already_participating` |
| FK on `athlete_profile_id` | `athlete_profile_not_found` |

Any unrecognized failure becomes `{ kind: "unavailable" }` with a neutral,
driver-free detail string. No SQLSTATE, constraint name, or driver exception
escapes an adapter.

## Aggregate versioning

`persons` and `athlete_profiles` carry a `version` column for future optimistic
concurrency; immutable history (`sports_ids`, `athlete_sport_participations`) and
reference data (`sports`) do not. Initial version is `1`; a mutating write
increments it and applies only when the stored version matches the caller's
expected version, otherwise the write affects zero rows and the caller has lost
the race. No update use case exists yet, so this is schema/contract foundation
only and `version` is not surfaced on domain objects. See ADR-021.

## Ownership and access classification

| Entity | Classification | RLS today |
|---|---|---|
| Person | Platform-global | RLS on, no policy (deny via Data API) |
| Sports ID | Platform-global | RLS on, no policy |
| AthleteProfile | Person-owned | RLS on, no policy |
| AthleteSportParticipation | Person-owned (history) | RLS on, no policy |
| Sport | Platform reference | RLS on, no policy |
| Date of birth (on Person) | Person-private | Never exposed by public queries |

No tenant RLS is invented for these platform-global / person-owned / reference
entities. Row Level Security is enabled with **no policies** on every table,
which denies all access through the Supabase Data API (anon/authenticated); the
trusted server-side connection used by the adapters reaches the data. Tenant RLS
is deferred to the first tenant-owned slice so it can be designed against a real
ownership predicate rather than guessed now. Auth-based access control is out of
scope. See `operations/database.md` for the operational view.

## Events and durability

Events are still published only **after** a successful persistence write, via
the no-op publisher. Database durability and event publication are **not yet
atomic** — there is no transactional outbox in Sprint 4, and no exactly-once
delivery is claimed. Building the outbox is future work.

## In-memory vs PostgreSQL

The in-memory repositories are retained and model the same observable semantics,
so deterministic unit tests keep describing production behavior. Production uses
the PostgreSQL adapters and requires a configured database — it never silently
falls back to in-memory storage. Test composition stays in-memory.
