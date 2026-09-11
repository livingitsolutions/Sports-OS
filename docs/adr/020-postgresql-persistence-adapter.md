# ADR 020 — PostgreSQL Persistence Adapter

## Status

Accepted — **implemented in Sprint 4**.

## Date

2026-09-08 (Sprint 4)

## Context

Through Sprint 3 all storage was in-memory. In-memory repositories proved the
CreatePerson, CreateAthleteProfile, and AddAthleteSport slices and their
uniqueness semantics, but they are not durable: data is lost on restart. Sprint 4
introduces the first production persistence for exactly those already-proven
capabilities — Person, Sports ID, AthleteProfile, AthleteSportParticipation, and
the minimal Sport reference data they depend on — without expanding product
scope.

The layer model forbids infrastructure SDKs in the Domain and Application layers
(`domain-no-external-sdk`, `app-no-external-sdk` in `.dependency-cruiser.cjs`).
The context-specific repository contracts (`PersonRepository`,
`AthleteProfileRepository`, `SportDirectory`) are the application boundary and do
not change. A database is a detail behind them.

## Decision

Add a PostgreSQL persistence adapter area at `src/adapters/persistence/pg/` and
back the existing contracts with it in the production composition.

1. **Driver, not ORM, not SDK.** Use the `postgres` (porsager) driver directly.
   No ORM and no generic CRUD abstraction. The driver is imported ONLY under
   `src/adapters/persistence/pg/`, satisfying the no-external-SDK rules for
   Domain and Application. We use a direct PostgreSQL connection rather than the
   Supabase JS SDK so the adapter depends on Postgres, not a hosting product.

2. **File layout.** `connection.ts` (the single place a connection is built and
   the only reader of database environment variables), `errors.ts` (driver →
   typed-outcome translation), `mappers.ts` (explicit row ↔ domain mapping),
   and one repository adapter per contract (`pg-person-repository.ts`,
   `pg-athlete-profile-repository.ts`, `pg-sport-directory.ts`).

3. **No row types leak.** Adapters select an explicit column list and translate
   rows into domain objects in `mappers.ts`. Database-only columns (`version`,
   `created_at` on Person) never appear on domain objects. Private identity data
   (date of birth) is mapped only for the owning Person, never for athlete rows.

4. **Typed outcomes, no driver leak.** Adapters translate PostgreSQL failures
   into the persistence-error unions the contracts already define
   (`duplicate_person_id`, `duplicate_sports_id`, `person_already_has_profile`,
   `duplicate_athlete_profile_id`, `already_participating`,
   `athlete_profile_not_found`, `unavailable`). No SQLSTATE code, constraint
   name, or driver exception escapes an adapter.

5. **Atomic Person + Sports ID.** `PgPersonRepository.create` inserts the Person
   and its Sports ID inside one `sql.begin()` transaction, so neither can exist
   without the other. Database constraints are the final uniqueness guard behind
   the use-case pre-checks.

6. **Production requires the database.** Production composition builds the
   connection from the environment and fails loudly when it is absent. There is
   NO silent fallback to in-memory storage in production. The in-memory adapters
   are retained for deterministic unit tests only.

## Consequences

**Positive:**
- Durable production storage with database-enforced invariants.
- Boundaries preserved: contracts unchanged, driver confined to one directory,
  `architecture:check` still zero violations.
- In-memory and PostgreSQL adapters share the same observable semantics, so unit
  tests continue to describe production behavior.

**Negative / risks:**
- Two adapter implementations per contract to keep in step.
- Event publication and database durability are not yet atomic (see ADR on the
  future outbox; a transactional outbox is explicitly out of Sprint 4 scope).

## Alternatives considered

- **Supabase JS SDK in adapters.** Rejected: couples persistence to a hosting
  product and its auth model; a plain Postgres driver keeps the dependency at
  "PostgreSQL".
- **An ORM / generic repository.** Rejected: the brief forbids a generic CRUD
  abstraction; context-specific contracts already express exactly what is needed.
- **Silent in-memory fallback when no DB is configured.** Rejected: hides a
  misconfigured production deploy behind a non-durable store.

## Compliance

- Driver import confined to `src/adapters/persistence/pg/`; `architecture:check`
  reports zero violations.
- Unit tests unchanged and green (in-memory). PostgreSQL integration tests exist
  under `tests/integration/` and run against a dedicated `TEST_DATABASE_URL`.
- Recorded in `architecture-version.md` (v0.6.0), `docs/persistence-model.md`,
  and `docs/operations/database.md`.
