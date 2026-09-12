import type { AggregateVersion } from "@domain/aggregate";
import type { Id, ISODateString } from "@shared/kernel";

/**
 * Organization — any structured body that owns or governs sport activity:
 * clubs, schools, associations, LGUs, governing bodies, sponsors (as
 * commercial orgs), venue operators. Discriminated by `kind`.
 *
 * Platform organizational identity. It has no tenantId and can exist before
 * users, teams, or events.
 */
export const ORGANIZATION_TYPES = ["club", "league", "association", "federation", "school", "government_body", "company", "event_organizer", "venue_operator", "other"] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
export type OrganizationStatus = "active" | "inactive";

export interface Organization {
  readonly id: Id<"Organization">;
  readonly name: string;
  readonly slug: string;
  readonly type: OrganizationType;
  readonly status: OrganizationStatus;
  readonly countryCode: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly version: AggregateVersion;
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
