# ADR-030: Finalized Contest Result Progression

- Status: Accepted
- Date: 2026-09-16
- Architecture version: v1.10.7

## Decision

A trusted `ProgressFinalizedContestResult` application use case consumes one finalized result and executes only deterministic `ContestOutcomeSource` rules whose `contestRef` matches the source Contest's durable `plan_ref`.

The authority chain is `ContestResult → ContestResultOutcome → ContestParticipant → CompetitionEntry → ContestOutcomeSource → target plan_ref and position → durable Contest → ContestParticipant`. Athlete and Team identity, scores, UI state, and Contest status alone are not progression authority.

The PostgreSQL adapter serializes on the source result, locks target Contests by sorted durable ID, validates lifecycle and same-format ownership under those locks, inserts all participants, and records one progression marker in a single transaction. Database uniqueness remains final authority for target-position races.

Progression is exactly one hop. It never evaluates a downstream result. A Final with no outgoing rule succeeds, records a marker with `participant_count = 0`, and publishes the same post-commit event. Progression does not determine a champion or standings.

## Consequences

Finalized results are consumed at most once. Historical CompetitionEntry identity is used without re-evaluating current entry or roster state. Event publication remains best-effort after commit because this slice intentionally adds no outbox.
