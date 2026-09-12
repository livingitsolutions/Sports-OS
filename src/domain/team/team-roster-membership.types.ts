import type { AggregateRoot, AggregateVersion } from "@domain/aggregate";
import type { Id, ISODateString } from "@shared/kernel";

export type TeamRosterMembershipStatus = "active" | "inactive";
export interface TeamRosterMembership extends AggregateRoot<"TeamRosterMembership"> {
  readonly teamId: Id<"Team">;
  readonly athleteProfileId: Id<"AthleteProfile">;
  readonly status: TeamRosterMembershipStatus;
  readonly joinedAt: ISODateString;
  readonly leftAt: ISODateString | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly version: AggregateVersion;
}
