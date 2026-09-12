import type { DomainEvent } from "@domain/aggregate";
import type { Id } from "@shared/kernel";
interface AuthEvent extends DomainEvent{aggregateType:"OrganizationRole"|"OrganizationRoleAssignment";organizationId:Id<"Organization">;aggregateVersion:number;}
export interface OrganizationRoleEvent extends AuthEvent{type:"organization.role_created"|"organization.role_permissions_updated"|"organization.role_deactivated"|"organization.role_reactivated";roleId:Id<"OrganizationRole">;}
export interface OrganizationRoleAssignmentEvent extends AuthEvent{type:"organization.role_assigned"|"organization.role_assignment_deactivated"|"organization.role_assignment_reactivated";assignmentId:Id<"OrganizationRoleAssignment">;membershipId:Id<"OrganizationMembership">;roleId:Id<"OrganizationRole">;}
