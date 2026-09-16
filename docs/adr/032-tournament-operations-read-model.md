# ADR-032: Tournament Operations application projection

## Decision

Tournament Operations is an application-owned, read-only projection over authoritative competition state. It is not a new aggregate and stores no additional lifecycle status. The read path is `Presentation (future) → GetTournamentOperationsView → TournamentOperationsReader → existing competition persistence`.

The application derives phase in strict precedence order: finalized CompetitionOutcome gives `completed`; terminal zero-participant progression gives `final_pending`; any non-terminal consumed progression gives `in_progress`; finalized seeding plus initial participants gives `ready`; any assignment or finalized seed map gives `seeding`; materialization without assignments gives `awaiting_seeding`; otherwise `setup`.

Competition lifecycle, tournament operations phase, Contest lifecycle, sporting result, and CompetitionOutcome remain distinct. Only `single_elimination` is supported. Generated structures are selected exclusively by `competition_stages.competition_format_id`; manual stages are excluded. Participant provenance and structural byes are returned as persisted without identity joins or synthetic competitors.

PostgreSQL uses one repeatable-read, read-only transaction and set-based queries for hierarchy/materialization, seeds, structures, participants, results/progressions, and outcome. Query count is constant, not per Contest. The in-memory adapter supplies the same snapshot contract with copy-on-read behavior.

Authorization derives Organization from Format → Competition → Event → Organization and requires an active membership holding exact `organization.events.read`. Manage permission, wildcards, caller-provided organization scope, and admin shortcuts do not qualify.

Historical participants and results remain visible after entry withdrawal because current CompetitionEntry lifecycle is not used as a projection filter.
