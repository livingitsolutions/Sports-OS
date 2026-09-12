import type { TeamRosterMembership } from "@domain/team/team-roster-membership.types";
import type { Id, Result } from "@shared/kernel";

export type TeamRosterMembershipPersistenceError = { kind: "duplicate_roster_membership_id" | "already_active" | "team_not_found" | "athlete_profile_not_found" | "roster_membership_not_found" | "concurrency_conflict" | "invalid_persistence_state" | "unavailable"; detail?: string };
export type TeamRosterMembershipLookup = { kind: "found"; membership: TeamRosterMembership } | { kind: "not_found" } | { kind: "invalid_persistence_state" | "unavailable"; detail?: string };
export interface TeamRosterMembershipRepository {
  create(membership: TeamRosterMembership): Promise<Result<TeamRosterMembership, TeamRosterMembershipPersistenceError>>;
  save(updated: TeamRosterMembership, expectedVersion: number): Promise<Result<TeamRosterMembership, TeamRosterMembershipPersistenceError>>;
  findById(id: Id<"TeamRosterMembership">): Promise<TeamRosterMembershipLookup>;
  findActiveByTeamAndAthlete(teamId: Id<"Team">, athleteProfileId: Id<"AthleteProfile">): Promise<TeamRosterMembershipLookup>;
  listByTeam(teamId: Id<"Team">): Promise<readonly TeamRosterMembership[]>;
}
