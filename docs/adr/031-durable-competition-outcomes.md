# ADR-031: Durable Competition Outcomes

## Status

Accepted — Sprint 10.1.7

## Decision

Single Elimination competition history is recorded as one immutable `CompetitionOutcome` per `CompetitionFormat`, with immutable `CompetitionPlacement` children. Only the structurally terminal contest in the reconstructed frozen plan can supply the source. Its finalized winner and loser outcomes resolve through contest participants to CompetitionEntry snapshots and create positions 1 and 2 after terminal progression has been consumed.

The application accepts no caller-supplied contest, result, entrant, or placement authority. PostgreSQL locks the format and terminal result, revalidates the complete authority chain, and inserts the outcome and both placements atomically. A post-commit, non-PII event announces success without an outbox.

## Consequences

Historical placement survives later entry withdrawal and identity changes. Competition lifecycle is not changed. This record is neither generic standings nor an achievement, Sports Passport item, reward, or ranking. Other competition formats remain unsupported until they receive format-specific derivation rules.
