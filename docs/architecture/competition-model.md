# Competition Foundation

SportsOS models structure as five independently versioned aggregate roots: Event → Competition → Division / Stage → Contest. Event is Organization-owned. Competition belongs to Event and references one Sport. Division is a categorization boundary for future eligibility. Stage belongs to Competition and may reference a Division in that same Competition. Contest belongs to Stage and is the smallest scheduled competitive unit. Descendants are never embedded and child transitions never change parents.

Event keys are unique within Organization. Competition keys are unique within Event. Division and Stage keys are unique within Competition; Stage uses `(competition_id, key)` for divided and undivided stages. Contest sequence is unique within Stage. Mutations use expected-version optimistic concurrency.

Contest is not equivalent to Match. It may later represent a match, bout, heat, race, measured attempt, or multi-participant unit. It has no two-side, home/away, participant, score, winner, loser, or result assumption. Completion is lifecycle only, not a verified sporting result.

Progression remains a separate future engine, potentially containing CompetitionFormat, Bracket, BracketNode/progression relations, ContestParticipant, ContestResult, and ProgressionRule. Registration, entries, eligibility, participant assignment, results, and scheduling optimization are deferred. `scheduledAt` is only an optional UTC timestamp.

General rosters remain separate: `TeamRosterMembership ≠ CompetitionEntry ≠ CompetitionEntryRoster ≠ ContestParticipant`. A future entry layer decides who enters.

Management authority derives through ancestry to `Event.organizationId`. An active membership needs `organization.events.manage`; `organization.events.read` covers reads. There is no type, owner, or global-admin shortcut.
# Competition entry foundation

`CompetitionEntry` answers who is structurally participating in a Competition after acceptance. It supports an AthleteProfile entrant or Team entrant through explicit nullable foreign keys plus an exact-one database CHECK; it does not use a free-form polymorphic entrant identifier. Division is optional, must be active when selected, and is protected by a composite foreign key to the same Competition. Later Division deactivation does not mutate entries.

Athlete creation requires an existing active AthleteSportParticipation for the Competition sport. Team creation requires an active Team with the same sport, but does not inspect or snapshot its roster. A Team owned by Organization B may enter a Competition organized by Organization A. Authorization remains `organization.events.manage` in Organization A, derived through the Event; Team ownership is not an authorization shortcut or restriction.

Entries begin active at version 1. Withdrawal is non-destructive and advances the version. A withdrawn athlete or Team may re-enter with a new CompetitionEntry ID, while partial unique indexes ensure only one active entry per entrant and Competition regardless of Division.

CompetitionEntry is distinct from Registration, TeamRosterMembership, future CompetitionEntryRoster, and future ContestParticipant. It contains no payment/application state, roster snapshot, seed, bracket, contest, result, or scheduling data. Trusted organizer commands are the current entry path; public registration later requires consent and workflow semantics before producing an accepted CompetitionEntry.
