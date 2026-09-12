# ADR-028: Competition seed assignment boundary

## Status

Accepted — SportsOS Architecture v1.10.3.

## Decision

Persist `CompetitionSeedAssignment` as the immutable mapping from a `CompetitionEntry` to a structural seed number in one materialized `CompetitionFormat`. Materialization stores its entrant count, and assignment requires the current active scoped count to match it. Valid seeds are discovered from the registered engine's generic plan, while entrant identities remain exclusively on `CompetitionEntry`.

Database uniqueness arbitrates concurrent claims for both `(format, seed)` and `(format, entry)`. Partial assignment is allowed. This concept does not create or mutate Contest participation.

## Consequences

Structural assumptions cannot silently drift after materialization. Manual assignment is durable and concurrency-safe without coupling engines or Contests to athlete or Team identity. Reassignment, bracket locking, ContestParticipant, results, and progression require later decisions.
