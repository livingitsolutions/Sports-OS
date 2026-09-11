import type { Id } from "@shared/kernel";

/**
 * Authorization model (see ADR-012, docs/architecture/authorization.md).
 *
 * This is NOT a single PersonRole aggregate. Authorization is derived from
 * scoped memberships and assignments, not permanent global person roles.
 * See docs/architecture/person-role-model.md for the full model.
 *
 * The types below define the separate concepts:
 *   - PlatformRole      (platform-level administrative capabilities)
 *   - OrganizationMembership (a Person belongs to an Organization)
 *   - OrganizationRoleAssignment (a Person holds a role within an org)
 *   - TeamMembership     (a Person/AthleteProfile is on a Team)
 *   - EventAssignment    (a Person is assigned to an Event in a capacity)
 *   - Permission         (a scoped capability string)
 *   - PermissionScope    (the scope at which a permission is evaluated)
 */

export type PlatformRole = "platform_admin" | "platform_support";

export interface PlatformRoleAssignment {
  readonly id: Id<"PlatformRoleAssignment">;
  readonly personId: Id<"Person">;
  readonly role: PlatformRole;
}

export type OrganizationRoleKind =
  | "organizer"
  | "official"
  | "coach"
  | "team_manager"
  | "staff"
  | "sponsor_representative";

export interface OrganizationMembership {
  readonly id: Id<"OrganizationMembership">;
  readonly personId: Id<"Person">;
  readonly organizationId: Id<"Organization">;
  readonly tenantId: Id<"Tenant">;
}

export interface OrganizationRoleAssignment {
  readonly id: Id<"OrganizationRoleAssignment">;
  readonly membershipId: Id<"OrganizationMembership">;
  readonly role: OrganizationRoleKind;
}

export interface TeamMembership {
  readonly id: Id<"TeamMembership">;
  readonly personId: Id<"Person">;
  readonly athleteProfileId: Id<"AthleteProfile"> | null;
  readonly teamId: Id<"Team">;
  readonly tenantId: Id<"Tenant">;
}

export type EventAssignmentCapacity =
  | "official"
  | "organizer"
  | "scorer"
  | "marshal"
  | "timekeeper"
  | "judge";

export interface EventAssignment {
  readonly id: Id<"EventAssignment">;
  readonly personId: Id<"Person">;
  readonly eventId: Id<"Event">;
  readonly tenantId: Id<"Tenant">;
  readonly capacity: EventAssignmentCapacity;
}

/**
 * A Permission is a scoped capability string, namespaced by context.
 * Permissions are derived from memberships/assignments, not hard-coded.
 */
export type Permission = string;

/**
 * The scope at which a permission is evaluated.
 */
export type PermissionScope =
  | { readonly kind: "platform" }
  | { readonly kind: "organization"; readonly organizationId: Id<"Organization"> }
  | { readonly kind: "team"; readonly teamId: Id<"Team"> }
  | { readonly kind: "event"; readonly eventId: Id<"Event"> }
  | { readonly kind: "person"; readonly personId: Id<"Person"> };

/**
 * Guardian relationship — a separate relationship between two Persons, not a
 * field on Person. [S3] Person carries no `guardianId`. The guardian scope is a
 * Person scope, not an Organization scope.
 */
export interface GuardianRelationship {
  readonly id: Id<"GuardianRelationship">;
  readonly guardianPersonId: Id<"Person">;
  readonly minorPersonId: Id<"Person">;
}
