# Database Operations

> Operating the SportsOS PostgreSQL database introduced in architecture v0.6.0
> (Sprint 4). Companion to `../persistence-model.md`, ADR-020, ADR-021, ADR-022.

## Configuration

The database connection is supplied entirely through the environment. Nothing is
hard-coded and no secret is committed. `src/adapters/persistence/pg/connection.ts`
is the only reader of these variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Takes precedence. |
| `SUPABASE_DB_URL` | Provisioned fallback connection string. |
| `TEST_DATABASE_URL` | Disposable database for integration tests. Optional. |

`.env.example` lists these names with empty placeholders only. Copy it to `.env`
and fill in real values; never commit real credentials.

**Fail loud, never degrade.** The production composition builds the connection
at startup and throws a clear error when neither `DATABASE_URL` nor
`SUPABASE_DB_URL` is set. There is no silent fallback to in-memory storage in
production — a missing connection string stops the app rather than quietly
losing durability. SSL is required for hosted providers and disabled only for
local/loopback connection strings.

## Migrations

Schema is applied exclusively through the Supabase migration tooling. The
application never issues DDL and never mutates schema at startup.

Applied migrations (append-only, numbered, immutable):

| Migration | Contents |
|---|---|
| `0001_sprint4_core_persistence` | `persons`, `sports_ids`, `athlete_profiles`, `athlete_sport_participations`, `sports`; constraints, the partial active-participation index, version columns; RLS enabled on all five tables. |
| `0002_sprint4_sport_reference_seed` | Minimal, non-exhaustive Sport reference rows. |

### Rules (see ADR-022)

1. Migrations are numbered and immutable once applied. A new change is always a
   new, higher-numbered migration — history is append-only.
2. Migrations are deterministic and idempotent (`IF NOT EXISTS` / `IF EXISTS`,
   drop-then-create for policies) and each opens with a markdown summary.
3. Destructive changes (`DROP`, column-type change, rename) require explicit
   review; the default posture is additive.
4. Prefer forward-fixes: repair a mistake with a new additive migration rather
   than editing an applied one. A true rollback is a reviewed compensating
   migration.
5. No schema mutation from application startup.

## Seed data

The Sport seed is the minimum needed for participation to reference a real
sport. It is deterministic and intentionally not an exhaustive catalog. No
business logic is hard-coded around specific seed rows; code checks sport
existence through `SportDirectory`, not against fixed IDs.

## Security posture (Sprint 4)

- **RLS enabled, no policies** on every table. Through the Supabase Data API
  (anon/authenticated roles) this denies all access. The adapters connect with a
  trusted server-side role that reaches the data. The security linter reports
  this as INFO-level `rls_enabled_no_policy`, which is the intended state for
  this slice, not a defect.
- **No tenant RLS** is invented for these platform-global, person-owned, and
  reference entities. Tenant-scoped RLS is deferred to the first tenant-owned
  slice so it is designed against a real ownership predicate. This does not
  weaken future security; it avoids guessing a policy now.
- **Auth-based access control is out of scope** for Sprint 4.

## Integration tests

PostgreSQL integration tests live in `tests/integration/` and exercise the real
constraints (atomic Person + Sports ID, one profile per Person, one active
participation with re-entry, sport existence). They are guarded on
`TEST_DATABASE_URL` and **skip cleanly when it is unset** — they are never
pointed at the production database automatically and never fake a pass. Point
`TEST_DATABASE_URL` at a disposable database with the Sprint 4 migrations applied
to run them; each run uses a unique key prefix and removes only its own rows.

Unit tests (in-memory, deterministic) are separate and always run via
`npm run test`.

## Schema validation

Schema can be validated directly against the live database: confirm the partial
index predicate (`WHERE status = 'active'`), the uniqueness constraints, the
version columns and their `CHECK (version >= 1)`, and that RLS is enabled with no
policies. These checks were run for Sprint 4 and matched the intended schema.
