# ADR-024: Competition entry is accepted structural participation

- Status: Accepted
- Architecture: SportsOS v1.9.0

## Decision

`CompetitionEntry` records who has been accepted into one Competition. An entrant is either an AthleteProfile or a Team, never both, and optional Division membership is constrained to that same Competition. Creation requires an active, sport-compatible entrant and an open (`draft` or `active`) Competition. Withdrawal closes the historical entry; re-entry creates a new aggregate.

Organizer authority derives through Competition → Event → Organization and requires the exact `organization.events.manage` permission on an active membership. A Team may belong to another Organization: entrant ownership does not become organizer authorization ownership.

## Boundaries

CompetitionEntry is not a Registration application, approval, eligibility, or payment record. A future Registration flow may produce an accepted CompetitionEntry after its own checks. Trusted internal organizer commands are the only entry path in this sprint; future public or self-service registration must add consent, acceptance, or invitation semantics.

A Team entry does not snapshot `TeamRosterMembership`. That membership remains mutable historical club/team affiliation. A future `CompetitionEntryRoster` will identify the athletes representing a Team in a specific Competition.

CompetitionEntry is not attached to Contest. A later format layer may transform entries through seeding into `ContestParticipant`. No bracket position, progression, result, payment, or scheduling semantics belong here.

## Consequences

PostgreSQL CHECK and foreign-key constraints enforce entrant shape and Division consistency. Partial unique indexes allow withdrawn history while limiting each athlete or Team to one active entry per Competition, independent of Division. Optimistic versioning protects withdrawal, and domain events are published after persistence without an outbox.
