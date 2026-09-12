import type { DomainEvent } from "@domain/aggregate";
import type { Id } from "@shared/kernel";

interface MembershipEvent extends DomainEvent {
  readonly aggregateType: "OrganizationMembership";
  readonly membershipId: Id<"OrganizationMembership">;
  readonly organizationId: Id<"Organization">;
  readonly personId: Id<"Person">;
  readonly aggregateVersion: number;
}
export interface OrganizationMembershipCreated extends MembershipEvent { readonly type: "organization.membership_created"; }
export interface OrganizationMembershipDeactivated extends MembershipEvent { readonly type: "organization.membership_deactivated"; }
export interface OrganizationMembershipReactivated extends MembershipEvent { readonly type: "organization.membership_reactivated"; }
export type OrganizationMembershipEvent = OrganizationMembershipCreated | OrganizationMembershipDeactivated | OrganizationMembershipReactivated;
