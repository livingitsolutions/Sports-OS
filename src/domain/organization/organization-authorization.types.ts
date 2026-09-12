import type { AggregateRoot, AggregateVersion } from "@domain/aggregate";
import type { Id, ISODateString } from "@shared/kernel";
export const ORGANIZATION_PERMISSIONS=["organization.read","organization.update","organization.members.read","organization.members.manage","organization.roles.read","organization.roles.manage","organization.trust.read","organization.trust.manage"] as const;
export type OrganizationPermission=(typeof ORGANIZATION_PERMISSIONS)[number];
export type AuthorizationStatus="active"|"inactive";
export type OrganizationRoleKind="system"|"custom";
export interface OrganizationRole extends AggregateRoot<"OrganizationRole">{organizationId:Id<"Organization">;name:string;key:string;roleKind:OrganizationRoleKind;permissions:readonly OrganizationPermission[];status:AuthorizationStatus;createdAt:ISODateString;updatedAt:ISODateString;version:AggregateVersion;}
export interface OrganizationRoleAssignment extends AggregateRoot<"OrganizationRoleAssignment">{organizationId:Id<"Organization">;membershipId:Id<"OrganizationMembership">;roleId:Id<"OrganizationRole">;status:AuthorizationStatus;createdAt:ISODateString;updatedAt:ISODateString;version:AggregateVersion;}
