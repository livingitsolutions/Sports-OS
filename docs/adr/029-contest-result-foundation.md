# ADR-029: Contest result foundation

## Status

Accepted — SportsOS Architecture v1.10.6.

## Decision

`Contest`, `ContestParticipant`, `ContestResult`, and `ContestResultOutcome` are separate concepts. A Contest describes competition execution, a participant connects a CompetitionEntry to a Contest position, and a finalized result durably owns structural winner and loser outcomes referencing those participants.

Contest completion does not establish an authoritative winner. The trusted `RecordContestResult` operation explicitly finalizes one immutable result after deriving the owning Organization, authorizing `organization.events.manage`, and validating a completed two-participant Contest. PostgreSQL locks that Contest and atomically persists the header and both outcomes. A second attempt is rejected as `result_already_finalized`.

Participant references preserve historical identity through later CompetitionEntry, roster, or athlete participation changes. Athlete and Team identity are not copied into results.

## Consequences

The future progression flow is `finalized ContestResult → ContestResultOutcome → ContestParticipant → CompetitionEntry → ContestOutcomeSource`. This decision does not execute that flow, create downstream participants, or add sport-specific performance details. Scores, sets, times, measurements, draws, rankings, forfeits, and corrections remain deferred.
