import { INITIAL_AGGREGATE_VERSION, nextAggregateVersion } from "@domain/aggregate";
import type { TeamEvent } from "@domain/team/team.events";
import type { Team } from "@domain/team/team.types";
import { Result } from "@shared/kernel";
import type { DomainError, Id, ISODateString, Result as R } from "@shared/kernel";

type Meta = { now: ISODateString; eventId: string };
export function normalizeTeamName(value: string): string { return value.trim().replace(/\s+/g, " "); }
export function normalizeTeamKey(value: string): string { return value.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/-+/g, "-"); }

export function createTeam(input: { teamId: Id<"Team">; organizationId: Id<"Organization">; sportId: Id<"Sport">; name: string; key: string } & Meta): R<{ team: Team; event: TeamEvent }, DomainError> {
  const name = normalizeTeamName(input.name), key = normalizeTeamKey(input.key);
  if (!input.teamId.trim() || !input.organizationId.trim() || !input.sportId.trim()) return Result.fail(error("required_id", "Team, Organization, and Sport identifiers are required."));
  if (!name || name.length > 120) return Result.fail(error("invalid_name", "Team name must contain 1 to 120 characters."));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || key.length > 64) return Result.fail(error("invalid_key", "Team key must be URL-safe lowercase ASCII and at most 64 characters."));
  const team: Team = { id: input.teamId, organizationId: input.organizationId, sportId: input.sportId, name, key, status: "active", createdAt: input.now, updatedAt: input.now, version: INITIAL_AGGREGATE_VERSION };
  return Result.ok({ team, event: event("team.team_created", team, input) });
}
export function deactivateTeam(team: Team, meta: Meta): R<{ team: Team; event: TeamEvent }, DomainError> {
  if (team.status !== "active") return Result.fail(error("team_not_active", "Team is not active."));
  return transition({ ...team, status: "inactive" }, "team.team_deactivated", meta);
}
export function reactivateTeam(team: Team, meta: Meta): R<{ team: Team; event: TeamEvent }, DomainError> {
  if (team.status !== "inactive") return Result.fail(error("team_not_inactive", "Team is not inactive."));
  return transition({ ...team, status: "active" }, "team.team_reactivated", meta);
}
export function isValidTeam(team: Team): boolean { return Boolean(team.id && team.organizationId && team.sportId && normalizeTeamName(team.name) === team.name && team.name.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(team.key) && team.key.length <= 64 && ["active", "inactive"].includes(team.status) && Number.isInteger(team.version) && team.version > 0 && !Number.isNaN(Date.parse(team.createdAt)) && Date.parse(team.updatedAt) >= Date.parse(team.createdAt)); }
function transition(team: Team, type: TeamEvent["type"], meta: Meta) { const updated = { ...team, updatedAt: meta.now, version: nextAggregateVersion(team.version) }; return Result.ok({ team: updated, event: event(type, updated, meta) }); }
function event(type: TeamEvent["type"], team: Team, meta: Meta): TeamEvent { return { type, eventId: meta.eventId, occurredAt: meta.now, aggregateId: team.id, aggregateType: "Team", teamId: team.id, organizationId: team.organizationId, sportId: team.sportId, version: team.version }; }
function error(code: string, message: string): DomainError { return { code, message }; }
