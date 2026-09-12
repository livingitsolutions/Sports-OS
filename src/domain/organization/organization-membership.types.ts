import type { AggregateRoot, AggregateVersion } from "@domain/aggregate";
import type { Id, ISODateString } from "@shared/kernel";

export type OrganizationMembershipStatus = "active" | "inactive";
export interface OrganizationMembership extends AggregateRoot<"OrganizationMembership"> {
  readonly organizationId: Id<"Organization">;
  readonly personId: Id<"Person">;
  readonly status: OrganizationMembershipStatus;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly version: AggregateVersion;
}
