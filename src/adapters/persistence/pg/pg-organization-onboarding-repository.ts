import type { OrganizationOnboardingCommand, OrganizationOnboardingPersistenceError, OrganizationOnboardingRepository, OrganizationOnboardingResult } from "@app/contracts/organization-onboarding-repository";
import type { Sql } from "@adapters/persistence/pg/connection";
import { executeOrganizationBootstrap } from "@adapters/persistence/pg/pg-organization-bootstrap-repository";
import { neutralDetail, pgErrorInfo } from "@adapters/persistence/pg/errors";
import { toOrganization, type OrganizationRow } from "@adapters/persistence/pg/mappers";
import type { Result } from "@shared/kernel";

type ReplayRow = OrganizationRow & { initial_administrator_person_id: string };
class OnboardingRollback extends Error { constructor(readonly cause: OrganizationOnboardingPersistenceError) { super(cause.kind); } }
export class PgOrganizationOnboardingRepository implements OrganizationOnboardingRepository {
  constructor(private readonly sql: Sql) {}
  async onboard(command: OrganizationOnboardingCommand): Promise<Result<OrganizationOnboardingResult, OrganizationOnboardingPersistenceError>> {
    try { return await this.sql.begin(async raw => { const result = await this.run(raw as unknown as Sql, command); if (!result.ok) throw new OnboardingRollback(result.error); return result; }); }
    catch (error) { if (error instanceof OnboardingRollback) return { ok: false, error: error.cause }; const info=pgErrorInfo(error); if(info?.code==="40001"||info?.code==="40P01")return fail("concurrency_conflict"); if(info?.code==="23505"&&info.constraint.includes("organizations_slug"))return fail("organization_slug_conflict"); if(info?.code==="23505"&&info.constraint.includes("organization_onboardings_pkey"))return this.readReplay(command); return fail("unavailable",neutralDetail(error)); }
  }
  private async run(tx: Sql, c: OrganizationOnboardingCommand): Promise<Result<OrganizationOnboardingResult, OrganizationOnboardingPersistenceError>> {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${c.onboardingRequestKey},0))`;
    const replay=await this.replay(tx,c.onboardingRequestKey); if(replay)return this.handleReplay(tx,replay,c);
    const person=await tx<{id:string}[]>`SELECT id FROM persons WHERE id=${c.initialAdministratorPersonId}`; if(!person[0])return fail("person_not_found");
    const o=c.organization;
    await tx`INSERT INTO organizations(id,name,slug,type,status,country_code,version,created_at,updated_at) VALUES(${o.id},${o.name},${o.slug},${o.type},${o.status},${o.countryCode},${o.version},${o.createdAt},${o.updatedAt})`;
    const bootstrap=await executeOrganizationBootstrap(tx,{organizationId:o.id,personId:c.initialAdministratorPersonId,membershipId:c.membershipId,roleId:c.roleId,assignmentId:c.assignmentId,now:c.now});
    if(!bootstrap.ok)return fail(bootstrap.error.kind==="bootstrap_already_established"?"bootstrap_conflict":bootstrap.error.kind==="unavailable"?"unavailable":bootstrap.error.kind as "person_not_found"|"invalid_persistence_state"|"concurrency_conflict");
    await tx`INSERT INTO organization_onboardings(request_key,organization_id,initial_administrator_person_id,created_at) VALUES(${c.onboardingRequestKey},${o.id},${c.initialAdministratorPersonId},${c.now})`;
    return {ok:true,value:{organization:o,bootstrap:bootstrap.value,replayed:false}};
  }
  private async readReplay(c:OrganizationOnboardingCommand){try{return await this.sql.begin(async raw=>{const tx=raw as unknown as Sql,row=await this.replay(tx,c.onboardingRequestKey);return row?this.handleReplay(tx,row,c):fail("concurrency_conflict");});}catch(error){return fail("unavailable",neutralDetail(error));}}
  private async replay(tx:Sql,key:string){const rows=await tx<ReplayRow[]>`SELECT o.id,o.name,o.slug,o.type,o.status,o.country_code,o.version,o.created_at,o.updated_at,x.initial_administrator_person_id FROM organization_onboardings x JOIN organizations o ON o.id=x.organization_id WHERE x.request_key=${key} LIMIT 1`;return rows[0];}
  private async handleReplay(tx:Sql,row:ReplayRow,c:OrganizationOnboardingCommand):Promise<Result<OrganizationOnboardingResult,OrganizationOnboardingPersistenceError>>{const organization=toOrganization(row);if(!organization)return fail("invalid_persistence_state");if(row.initial_administrator_person_id!==c.initialAdministratorPersonId||organization.name!==c.organization.name||organization.slug!==c.organization.slug||organization.type!==c.organization.type||organization.countryCode!==c.organization.countryCode)return fail("bootstrap_conflict");const bootstrap=await executeOrganizationBootstrap(tx,{organizationId:organization.id,personId:c.initialAdministratorPersonId,membershipId:c.membershipId,roleId:c.roleId,assignmentId:c.assignmentId,now:c.now});if(!bootstrap.ok)return fail(bootstrap.error.kind==="bootstrap_already_established"?"bootstrap_conflict":bootstrap.error.kind==="unavailable"?"unavailable":bootstrap.error.kind as "person_not_found"|"invalid_persistence_state"|"concurrency_conflict");return {ok:true,value:{organization,bootstrap:bootstrap.value,replayed:true}};}
}
function fail(kind:OrganizationOnboardingPersistenceError["kind"],detail?:string):Result<never,OrganizationOnboardingPersistenceError>{return {ok:false,error:{kind,...(detail?{detail}:{})}};}
