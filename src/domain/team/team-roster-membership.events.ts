import type { DomainEvent } from "@domain/aggregate";
import type { Id } from "@shared/kernel";

export interface TeamRosterMembershipEvent extends DomainEvent {
  readonly type: "team.roster_member_added" | "team.roster_member_removed";
  readonly aggregateType: "TeamRosterMembership";
  readonly rosterMembershipId: Id<"TeamRosterMembership">;
  readonly teamId: Id<"Team">;
  readonly athleteProfileId: Id<"AthleteProfile">;
  readonly version: number;
}
