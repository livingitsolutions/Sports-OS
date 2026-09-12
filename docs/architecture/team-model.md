# Team model

A Team is an Organization-owned identity for a future competition participant. It remains distinct from its Organization (and from a club, Person, AthleteProfile, roster, or tournament entry), belongs to exactly one existing Sport, and uses `organizationId` as its ownership and isolation boundary; it has no `tenantId`.

Teams currently contain identity and active/inactive lifecycle only. They contain no roster, age, division, gender, or other competition eligibility, and no Organization type or club inference. Multi-sport Organizations create a separate Team for each Sport. Team keys are unique only within an Organization.

## Roster membership history

`TeamRosterMembership` is a separate aggregate linking Team to AthleteProfile, never Person. It records one membership period; leaving preserves history and rejoining creates a new row. An athlete may concurrently belong to multiple Teams. Adding requires an active Team, matching active AthleteSportParticipation, and `organization.teams.manage` in the owning Organization. Leaving does not depend on current Team or participation status. Transfer exclusivity, capacity, eligibility, and competition rosters remain out of scope; `TeamRosterMembership` is not `CompetitionEntryRoster`.
