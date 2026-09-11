# ADR 021 — Aggregate Versioning

## Status

Accepted — **corrected and exercised in Sprint 4.2**.

## Date

2026-09-08 (Sprint 4)

## Context

Sprint 4 adds durable storage for mutable aggregate roots (Person,
AthleteProfile) and immutable historical/reference records (Sports ID issuance,
participation history, Sport reference data). Concurrent updates to a mutable
root can silently overwrite one another (a lost update). The brief asks whether
explicit aggregate versioning is justified now and, if so, to establish the
schema and contract foundation even though no update use case exists yet.

## Decision

Add an explicit optimistic-concurrency `version` column to the mutable roots
only, and document its semantics as an infrastructure-independent domain
concept.

1. **Where.** `persons.version` and `athlete_profiles.version`
   (`integer NOT NULL DEFAULT 1 CHECK (version >= 1)`). These are the roots that
   will gain update use cases (e.g. lifecycle transitions, profile status).

2. **Where NOT.** No version column on `sports_ids`, `athlete_sport_participations`,
   or `sports`. A Sports ID issuance and a participation record are immutable
   historical facts; a Sport is reference data. Ending participation is modelled
   as a new lifecycle state on a new/updated row, not an in-place optimistic
   update contended by concurrent writers.

3. **Semantics (domain-level, storage-independent):**
   - **Initial version** is `1` in the domain-created aggregate; creation
     persists that same `1`.
   - **Ownership:** aggregate owns version advancement; persistence owns
     concurrency verification.
   - **Increment:** a successful domain mutation changes N to N+1 before save.
   - **Expected-version update:** an update carries the version the caller read;
     the write applies only if the stored version still equals it
     together with the updated aggregate carrying N+1. Persistence writes the
     supplied N+1 using `UPDATE ... WHERE id = $id AND version = $expected`.
   - **Stale write:** if no row matches the expected version, the update affected
     zero rows — the caller lost the race and must re-read and retry or surface a
     conflict. This maps to a typed outcome, never a silent overwrite.

4. **Domain-visible value.** `AggregateVersion` is carried by Person and
   AthleteProfile and rehydrated from storage. Repositories verify it; they do
   not independently increment it.

5. **Event meaning.** A mutation event describes the completed domain
   transition and carries the aggregate's N+1 version where relevant. The
   repository never patches or manufactures it. Publication follows successful
   persistence; atomic database/message delivery remains future work.

## Consequences

**Positive:**
- The schema is ready for safe concurrent updates without a later destructive
  migration to add the column.
- Immutable records are not burdened with a meaningless version.

**Negative / risks:**
- A column exists before any code uses it. This is intentional foundation; it is
  documented so a future reader does not mistake it for dead schema.

## Alternatives considered

- **No version column until an update use case exists.** Rejected: adding a
  `NOT NULL` column to a populated table later is a riskier migration than
  establishing it now while the tables are empty.
- **Version every table, including history/reference.** Rejected: immutable and
  reference rows are never contended by in-place updates; a version there is
  noise.
- **Timestamp-based concurrency (`updated_at`).** Rejected: coarser and
  clock-sensitive; an integer version is exact and simple.

## Compliance

- `persons.version` and `athlete_profiles.version` present with
  `DEFAULT 1 CHECK (version >= 1)`; confirmed via schema inspection.
- No version column on `sports_ids`, `athlete_sport_participations`, `sports`.
- Semantics recorded here and in `docs/persistence-model.md`.
