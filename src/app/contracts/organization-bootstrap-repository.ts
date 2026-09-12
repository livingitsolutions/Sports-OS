import type { Id,ISODateString,Result } from "@shared/kernel";
export interface OrganizationBootstrapCommand{organizationId:Id<"Organization">;personId:Id<"Person">;membershipId:Id<"OrganizationMembership">;roleId:Id<"OrganizationRole">;assignmentId:Id<"OrganizationRoleAssignment">;now:ISODateString;}
export interface OrganizationBootstrapGraph{membershipId:Id<"OrganizationMembership">;roleId:Id<"OrganizationRole">;assignmentId:Id<"OrganizationRoleAssignment">;membershipVersion:number;roleVersion:number;assignmentVersion:number;established:boolean;}
export type OrganizationBootstrapPersistenceError={kind:"organization_not_found"|"person_not_found"|"bootstrap_already_established"|"invalid_persistence_state"|"concurrency_conflict"|"unavailable";detail?:string};
export interface OrganizationBootstrapRepository{bootstrap(command:OrganizationBootstrapCommand):Promise<Result<OrganizationBootstrapGraph,OrganizationBootstrapPersistenceError>>;}
