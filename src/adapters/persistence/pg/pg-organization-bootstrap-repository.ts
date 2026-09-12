import type { OrganizationBootstrapCommand,OrganizationBootstrapGraph,OrganizationBootstrapPersistenceError,OrganizationBootstrapRepository } from "@app/contracts/organization-bootstrap-repository";
import type { Sql } from "@adapters/persistence/pg/connection";
import { neutralDetail,pgErrorInfo } from "@adapters/persistence/pg/errors";
import { ORGANIZATION_PERMISSIONS } from "@domain/organization/organization-authorization.types";
import type { Id,Result } from "@shared/kernel";
const KEY="organization-admin",NAME="Organization Administrator",PERMISSIONS=[...ORGANIZATION_PERMISSIONS].sort();
interface Role{id:string;role_kind:string;permissions:string[];status:string;version:number;}interface Member{id:string;person_id:string;status:string;version:number;}interface Assignment{id:string;status:string;version:number;}
export class PgOrganizationBootstrapRepository implements OrganizationBootstrapRepository{
  constructor(private sql:Sql){}
  async bootstrap(c:OrganizationBootstrapCommand):Promise<Result<OrganizationBootstrapGraph,OrganizationBootstrapPersistenceError>>{try{return await this.sql.begin(async raw=>{const result=await executeOrganizationBootstrap(raw as unknown as Sql,c);if(!result.ok)throw new BootstrapRollback(result.error);return result;});}catch(error){if(error instanceof BootstrapRollback)return fail(error.cause.kind,error.cause.detail);const info=pgErrorInfo(error);return fail(info?.code==="40001"||info?.code==="40P01"?"concurrency_conflict":"unavailable",neutralDetail(error));}}
}
export async function executeOrganizationBootstrap(tx:Sql,c:OrganizationBootstrapCommand):Promise<Result<OrganizationBootstrapGraph,OrganizationBootstrapPersistenceError>>{
    const org=await tx<{id:string}[]>`SELECT id FROM organizations WHERE id=${c.organizationId} FOR UPDATE`;if(!org[0])return fail("organization_not_found");
    const person=await tx<{id:string}[]>`SELECT id FROM persons WHERE id=${c.personId}`;if(!person[0])return fail("person_not_found");
    const roleRows=await tx<Role[]>`SELECT id,role_kind,permissions,status,version FROM organization_roles WHERE organization_id=${c.organizationId} AND key=${KEY}`;let role=roleRows[0];
    if(role&&(!validRole(role)))return fail("invalid_persistence_state");
    const established=role?await tx<{id:string;person_id:string;membership_version:number;assignment_version:number}[]>`SELECT a.id,m.person_id,m.version membership_version,a.version assignment_version FROM organization_role_assignments a JOIN organization_memberships m ON m.id=a.membership_id WHERE a.organization_id=${c.organizationId} AND a.role_id=${role.id} AND a.status='active' AND m.status='active' LIMIT 1`:[];
    if(established[0]){if(established[0].person_id!==c.personId)return fail("bootstrap_already_established");return {ok:true,value:{membershipId:(await tx<Member[]>`SELECT id,person_id,status,version FROM organization_memberships WHERE organization_id=${c.organizationId} AND person_id=${c.personId}`)[0]!.id as Id<"OrganizationMembership">,roleId:role!.id as Id<"OrganizationRole">,assignmentId:established[0].id as Id<"OrganizationRoleAssignment">,membershipVersion:established[0].membership_version,roleVersion:role!.version,assignmentVersion:established[0].assignment_version,established:false}};}
    let member=(await tx<Member[]>`SELECT id,person_id,status,version FROM organization_memberships WHERE organization_id=${c.organizationId} AND person_id=${c.personId}`)[0];
    if(!member){[member]=await tx<Member[]>`INSERT INTO organization_memberships(id,organization_id,person_id,status,version,created_at,updated_at) VALUES(${c.membershipId},${c.organizationId},${c.personId},'active',1,${c.now},${c.now}) RETURNING id,person_id,status,version`;}
    else if(member.status==="inactive"){[member]=await tx<Member[]>`UPDATE organization_memberships SET status='active',version=version+1,updated_at=${c.now} WHERE id=${member.id} RETURNING id,person_id,status,version`;}
    else if(member.status!=="active")return fail("invalid_persistence_state");
    if(!role){[role]=await tx<Role[]>`INSERT INTO organization_roles(id,organization_id,name,key,role_kind,permissions,status,version,created_at,updated_at) VALUES(${c.roleId},${c.organizationId},${NAME},${KEY},'system',${tx.array(PERMISSIONS)},'active',1,${c.now},${c.now}) RETURNING id,role_kind,permissions,status,version`;}
    let assignment=(await tx<Assignment[]>`SELECT id,status,version FROM organization_role_assignments WHERE membership_id=${member!.id} AND role_id=${role!.id}`)[0];
    if(!assignment){[assignment]=await tx<Assignment[]>`INSERT INTO organization_role_assignments(id,organization_id,membership_id,role_id,status,version,created_at,updated_at) VALUES(${c.assignmentId},${c.organizationId},${member!.id},${role!.id},'active',1,${c.now},${c.now}) RETURNING id,status,version`;}
    else if(assignment.status==="inactive"){[assignment]=await tx<Assignment[]>`UPDATE organization_role_assignments SET status='active',version=version+1,updated_at=${c.now} WHERE id=${assignment.id} RETURNING id,status,version`;}
    else if(assignment.status!=="active")return fail("invalid_persistence_state");
    return {ok:true,value:{membershipId:member!.id as Id<"OrganizationMembership">,roleId:role!.id as Id<"OrganizationRole">,assignmentId:assignment!.id as Id<"OrganizationRoleAssignment">,membershipVersion:member!.version,roleVersion:role!.version,assignmentVersion:assignment!.version,established:true}};
}
class BootstrapRollback extends Error{constructor(readonly cause:OrganizationBootstrapPersistenceError){super(cause.kind);}}
function validRole(r:Role){return r.role_kind==="system"&&r.status==="active"&&r.permissions.length===PERMISSIONS.length&&[...r.permissions].sort().every((p,i)=>p===PERMISSIONS[i]);}
function fail(kind:OrganizationBootstrapPersistenceError["kind"],detail?:string):Result<never,OrganizationBootstrapPersistenceError>{return {ok:false,error:{kind,...(detail?{detail}:{})}};}
