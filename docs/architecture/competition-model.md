# Competition Foundation

SportsOS models structure as five independently versioned aggregate roots: Event → Competition → Division / Stage → Contest. Event is Organization-owned. Competition belongs to Event and references one Sport. Division is a categorization boundary for future eligibility. Stage belongs to Competition and may reference a Division in that same Competition. Contest belongs to Stage and is the smallest scheduled competitive unit. Descendants are never embedded and child transitions never change parents.

Event keys are unique within Organization. Competition keys are unique within Event. Division and Stage keys are unique within Competition; Stage uses `(competition_id, key)` for divided and undivided stages. Contest sequence is unique within Stage. Mutations use expected-version optimistic concurrency.

Contest is not equivalent to Match. It may later represent a match, bout, heat, race, measured attempt, or multi-participant unit. It has no two-side, home/away, participant, score, winner, loser, or result assumption. Completion is lifecycle only, not a verified sporting result.

Progression remains a separate future engine, potentially containing CompetitionFormat, Bracket, BracketNode/progression relations, ContestParticipant, ContestResult, and ProgressionRule. Registration, entries, eligibility, participant assignment, results, and scheduling optimization are deferred. `scheduledAt` is only an optional UTC timestamp.

General rosters remain separate: `TeamRosterMembership ≠ CompetitionEntry ≠ CompetitionEntryRoster ≠ ContestParticipant`. A future entry layer decides who enters.

Management authority derives through ancestry to `Event.organizationId`. An active membership needs `organization.events.manage`; `organization.events.read` covers reads. There is no type, owner, or global-admin shortcut.
