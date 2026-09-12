# ADR-023: Team roster membership history

Team roster membership is a separate, versioned aggregate linking a Team to an AthleteProfile. It contains no Person identity, Team name, sport, or Organization duplication. Adding requires an active Team, matching active sport participation, and `organization.teams.manage` in the Team's owning Organization.

Leaving closes rather than deletes a membership period. Rejoining creates a new aggregate and never reactivates the old row. Athletes may belong to multiple Teams concurrently; transfer exclusivity, capacity, and eligibility rules are absent.

`TeamRosterMembership` is general Team history, not `CompetitionEntryRoster`. Future competition registration may select or snapshot eligible Team members separately.
