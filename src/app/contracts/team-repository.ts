import type { Team } from "@domain/team/team.types";
import type { Id, Result } from "@shared/kernel";
export type TeamPersistenceError = { kind: "duplicate_team_id" | "duplicate_team_key" | "organization_not_found" | "sport_not_found" | "team_not_found" | "concurrency_conflict" | "invalid_persistence_state" | "unavailable"; detail?: string };
export type TeamLookup = { kind: "found"; team: Team } | { kind: "not_found" } | { kind: "invalid_persistence_state" | "unavailable"; detail?: string };
export interface TeamRepository {
  create(team: Team): Promise<Result<Team, TeamPersistenceError>>;
  save(updated: Team, expectedVersion: number): Promise<Result<Team, TeamPersistenceError>>;
  findById(id: Id<"Team">): Promise<TeamLookup>;
  findByOrganizationAndKey(organizationId: Id<"Organization">, key: string): Promise<TeamLookup>;
}
