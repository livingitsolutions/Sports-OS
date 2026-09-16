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
# Competition formats

`CompetitionFormat` is a durable format-selection aggregate; it is not a `Competition`, `Stage`, `Contest`, or `CompetitionEntry`. It belongs to one Competition and optionally one same-Competition Division. Retirement preserves history, and replacement creates a new aggregate. One active format is permitted per scope.

Format selection does not imply engine implementation. The catalog describes intent, while the engine registry may return `unsupported_format`. Engines are pure, deterministic, infrastructure-independent, identity-neutral, and sport-neutral. They receive entrant count, never AthleteProfile, Team, CompetitionEntry, names, or PII.

`CompetitionFormatPlan` is transient. It uses logical stage and contest references, generic contest capacity, and seed, contest-outcome, or stage-standing progression sources. Winner/loser are optional progression semantics and do not make Contest two-sided.

The structural flow is: Entries → determine entrant count → format engine → transient format plan → Stage/Contest generation → seed assignment. Materialization durably records `entrant_count`, freezing the structural assumption; assignment rejects active entrant-count drift rather than rebuilding.

`CompetitionSeedAssignment` maps one active `CompetitionEntry` to one positive structural seed in one materialized `CompetitionFormat`. It copies no athlete or Team identity. Both the seed and entry are unique within a format, and partial manual assignment is valid while seeding remains open.

The flow is `CompetitionEntry → CompetitionSeedAssignment → finalized seed map`. Finalization compares entry identities as exact sets, not merely counts, and separately requires exact coverage of the generic `SeedSource` numbers produced by the validated plan. `entrant_count` alone cannot detect a withdrawn assigned entrant replaced by a different active entrant.

A non-null materialization `seed_finalized_at` freezes the seed map. Later CompetitionEntry lifecycle changes neither mutate this snapshot nor rebuild or unlock the bracket. A finalized seed map is not a `ContestParticipant`: it creates no participant or slot and places no identity into Contest. ContestParticipant resolution is the next boundary; results and progression execution remain future boundaries.

## Single elimination planning

`SingleEliminationEngine` is the sole concrete engine in v1.10.1. It accepts an integer entrant count of at least two and selects the smallest power-of-two bracket at least that large. Thus `bracketSize = 2^ceil(log2(entrantCount))`, `byeCount = bracketSize - entrantCount`, and the number of elimination rounds is `log2(bracketSize)`.

Seed placement is deterministic and balanced. Beginning with `[1, 2]`, each bracket doubling to size `S` replaces every existing seed `s` with `[s, S + 1 - s]`; adjacent values are opening-round opponents. This conventional mirror-complement layout keeps seeds 1 and 2 in opposite halves and, from an eight-slot bracket onward, seeds 1–4 in separate quarter regions.

Slots above the entrant count are absences, not participants. Pairing an actual seed with an absent slot gives the seed a bye: its `SeedSource` feeds the appropriate position of the next real Contest directly. No one-participant Contest, fake entry, completed Contest, opponent, outcome, or progression from a nonexistent Contest is produced. Consequently the plan always contains exactly `entrantCount - 1` playable, capacity-two Contests.

There is one planned Stage for every bracket round, increasing toward `stage:final`. Every Contest position has exactly one source: either one structural seed or the winner of one earlier Contest. Every non-final winner feeds exactly one later position, loser progressions are absent, and the Final has no outgoing rule. The Final is only the graph endpoint; it does not identify or persist a champion.

Planning uses stable logical references and contains no AthleteProfile, Team, CompetitionEntry, name, database ID, time, or random value. The registry composition registers only `single_elimination`; other catalog kinds remain typed `unsupported_format`. The engine neither reads nor writes persistence, and plan materialization, entrant assignment, result interpretation, and progression execution remain future orchestration boundaries.
# Finalized result progression

One-hop progression follows this authority chain:

`Finalized ContestResult → ContestResultOutcome → source ContestParticipant → CompetitionEntry → ContestOutcomeSource → target PlannedContest.ref and numeric position → durable Contest.plan_ref → downstream ContestParticipant`.

Only rules originating from the supplied result's Contest are evaluated. Target lookup uses `plan_ref`, never names, sequence, query ordering, scores, or entrant identity. The captured CompetitionEntry is a historical snapshot; athlete, Team, roster, and current entry status are not re-evaluated or copied.

Progression is non-recursive. A downstream Contest requires its own independently finalized result and later invocation. A terminal Final has no outgoing placements but is marked progressed with a zero count. This does not create a champion or standings.
