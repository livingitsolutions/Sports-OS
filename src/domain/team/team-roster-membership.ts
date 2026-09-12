import { INITIAL_AGGREGATE_VERSION, nextAggregateVersion } from "@domain/aggregate";
import type { TeamRosterMembershipEvent } from "@domain/team/team-roster-membership.events";
import type { TeamRosterMembership } from "@domain/team/team-roster-membership.types";
import { Result } from "@shared/kernel";
import type { DomainError, Id, ISODateString, Result as R } from "@shared/kernel";

type Meta = { now: ISODateString; eventId: string };
export function createTeamRosterMembership(input: { rosterMembershipId: Id<"TeamRosterMembership">; teamId: Id<"Team">; athleteProfileId: Id<"AthleteProfile"> } & Meta): R<{ membership: TeamRosterMembership; event: TeamRosterMembershipEvent }, DomainError> {
  if (!input.rosterMembershipId.trim() || !input.teamId.trim() || !input.athleteProfileId.trim()) return Result.fail(err("required_id", "Roster membership, Team, and AthleteProfile identifiers are required."));
  const membership: TeamRosterMembership = { id: input.rosterMembershipId, teamId: input.teamId, athleteProfileId: input.athleteProfileId, status: "active", joinedAt: input.now, leftAt: null, createdAt: input.now, updatedAt: input.now, version: INITIAL_AGGREGATE_VERSION };
  return Result.ok({ membership, event: event("team.roster_member_added", membership, input) });
}
export function leaveTeamRosterMembership(membership: TeamRosterMembership, meta: Meta): R<{ membership: TeamRosterMembership; event: TeamRosterMembershipEvent }, DomainError> {
  if (membership.status !== "active" || membership.leftAt !== null) return Result.fail(err("roster_membership_inactive", "Roster membership is already inactive."));
  if (Date.parse(meta.now) < Date.parse(membership.joinedAt)) return Result.fail(err("invalid_leave_time", "Leave time cannot precede join time."));
  const updated: TeamRosterMembership = { ...membership, status: "inactive", leftAt: meta.now, updatedAt: meta.now, version: nextAggregateVersion(membership.version) };
  return Result.ok({ membership: updated, event: event("team.roster_member_removed", updated, meta) });
}
export function isValidTeamRosterMembership(m: TeamRosterMembership): boolean {
  const joined = Date.parse(m.joinedAt), left = m.leftAt === null ? null : Date.parse(m.leftAt);
  return Boolean(m.id && m.teamId && m.athleteProfileId && Number.isInteger(m.version) && m.version > 0 && !Number.isNaN(joined) && Date.parse(m.createdAt) === joined && Date.parse(m.updatedAt) >= joined && ((m.status === "active" && left === null) || (m.status === "inactive" && left !== null && left >= joined)));
}
function event(type: TeamRosterMembershipEvent["type"], m: TeamRosterMembership, meta: Meta): TeamRosterMembershipEvent { return { type, eventId: meta.eventId, occurredAt: meta.now, aggregateId: m.id, aggregateType: "TeamRosterMembership", rosterMembershipId: m.id, teamId: m.teamId, athleteProfileId: m.athleteProfileId, version: m.version }; }
function err(code: string, message: string): DomainError { return { code, message }; }
