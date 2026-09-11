# ADR 022 — Migration Discipline

## Status

Accepted — **adopted in Sprint 4**.

## Date

2026-09-08 (Sprint 4)

## Context

Sprint 4 creates the first real schema. Schema is applied through the Supabase
migration tooling (the `apply_migration` operation), which records numbered,
named migrations server-side. Without explicit discipline, schema drifts:
migrations get edited after they are applied, changes sneak in at application
startup, and destructive statements lose user data. The brief requires the rules
to be written down.

## Decision

Adopt the following migration rules for all schema changes.

1. **Numbered and immutable.** Migrations are numbered and applied in order. An
   applied migration is immutable — never casually edited to change already-live
   schema. (The one exception: if an apply times out but has actually committed,
   re-apply the SAME file unchanged; the SQL is idempotent, so this is safe and
   does not create a second logical migration.)

2. **New change, new migration.** Any schema change is a new, higher-numbered
   migration. History is append-only so any environment can be rebuilt by
   replaying migrations in order.

3. **Deterministic and idempotent.** Migrations use `IF NOT EXISTS` /
   `IF EXISTS` and drop-then-create for policies, so re-running one is safe and
   produces the same result. Each begins with a markdown summary describing the
   change for technical and non-technical readers.

4. **Destructive changes require review.** No `DROP TABLE`, `DROP COLUMN`,
   column-type change, or table rename without explicit review — these lose
   data. The default posture is additive.

5. **Rollback / forward-fix strategy.** Prefer forward fixes: a mistake is
   corrected by a new migration that additively repairs the schema, not by
   editing or deleting the offending one. True rollback (a compensating
   migration) is written explicitly and reviewed like any destructive change.

6. **No schema mutation from application startup.** The application never issues
   DDL. It assumes the schema already exists and fails loudly if it does not.
   Schema lives only in migrations.

## Consequences

**Positive:**
- Any environment is reproducible by replaying migrations.
- Data-loss operations are gated behind review; the common path is additive.
- No hidden startup DDL, so deploys are predictable.

**Negative / risks:**
- Forward-fix-only means a bad additive migration is followed by a corrective
  one rather than an edit — more migrations, but a truthful history.

## Alternatives considered

- **Editing applied migrations in place.** Rejected: environments that already
  ran the old version diverge silently.
- **Auto-migrating on application boot.** Rejected: couples deploy timing to
  schema changes and makes DDL failures a runtime crash surface; also violates
  "no schema mutation from app startup".

## Compliance

- Sprint 4 ships the minimum initial migrations only (core schema + a minimal,
  non-exhaustive Sport seed).
- Migrations are applied exclusively through the Supabase migration tooling;
  no DDL runs from application code.
- Rules restated in `docs/operations/database.md`.
