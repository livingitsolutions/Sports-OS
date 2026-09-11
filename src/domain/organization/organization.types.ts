import type { Id } from "@shared/kernel";

/**
 * Organization — any structured body that owns or governs sport activity:
 * clubs, schools, associations, LGUs, governing bodies, sponsors (as
 * commercial orgs), venue operators. Discriminated by `kind`.
 *
 * Ownership: organization/tenant-owned. An Organization belongs to a Tenant.
 * See docs/architecture/organization-model.md, tenancy.md, ADR-004, ADR-010.
 */
export type OrganizationKind =
  | "club"
  | "school"
  | "association"
  | "lgu"
  | "governing_body"
  | "sponsor"
  | "venue_operator";

export interface Organization {
  readonly id: Id<"Organization">;
  readonly tenantId: Id<"Tenant">;
  readonly kind: OrganizationKind;
  readonly legalName: string;
  readonly parentId: Id<"Organization"> | null;
}

/**
 * Team — a competing unit within competitions. A Team belongs to an
 * Organization but is NOT the organization itself.
 *
 * Ownership: organization/tenant-owned.
 * See docs/architecture/organization-model.md, ADR-005.
 */
export interface Team {
  readonly id: Id<"Team">;
  readonly tenantId: Id<"Tenant">;
  readonly organizationId: Id<"Organization">;
  readonly name: string;
  readonly sportId: Id<"Sport">;
}
