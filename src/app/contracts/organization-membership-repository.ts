import type { AggregateVersion } from "@domain/aggregate";
import type { OrganizationMembership } from "@domain/organization/organization-membership.types";
import type { Id, Result } from "@shared/kernel";
export type OrganizationMembershipPersistenceError = { readonly kind: "duplicate_membership_id" | "duplicate_membership" | "not_found" | "concurrency_conflict" } | { readonly kind: "invalid_persistence_state" | "unavailable"; readonly detail?: string };
export type OrganizationMembershipLookupResult = { readonly kind: "found"; readonly membership: OrganizationMembership } | { readonly kind: "not_found" } | { readonly kind: "invalid_persistence_state" | "unavailable"; readonly detail?: string };
export interface OrganizationMembershipRepository {
  create(value: OrganizationMembership): Promise<Result<OrganizationMembership, OrganizationMembershipPersistenceError>>;
  save(value: OrganizationMembership, expectedVersion: AggregateVersion): Promise<Result<OrganizationMembership, OrganizationMembershipPersistenceError>>;
  findById(id: Id<"OrganizationMembership">): Promise<OrganizationMembershipLookupResult>;
  findByOrganizationAndPerson(organizationId: Id<"Organization">, personId: Id<"Person">): Promise<OrganizationMembershipLookupResult>;
}
