import type { Organization } from "@domain/organization/organization.types";
import type { Id, Result } from "@shared/kernel";
export type OrganizationPersistenceError = { readonly kind: "duplicate_organization_id" } | { readonly kind: "duplicate_slug" } | { readonly kind: "invalid_persistence_state"; readonly detail?: string } | { readonly kind: "unavailable"; readonly detail?: string };
export type OrganizationLookupResult = { readonly kind: "found"; readonly organization: Organization } | { readonly kind: "not_found" } | { readonly kind: "invalid_persistence_state"; readonly detail?: string } | { readonly kind: "unavailable"; readonly detail?: string };
export interface OrganizationRepository { create(organization: Organization): Promise<Result<Organization, OrganizationPersistenceError>>; findById(id: Id<"Organization">): Promise<OrganizationLookupResult>; findBySlug(slug: string): Promise<OrganizationLookupResult>; }
