import type { OrganizationMembershipLookupResult, OrganizationMembershipPersistenceError, OrganizationMembershipRepository } from "@app/contracts/organization-membership-repository";
import type { AggregateVersion } from "@domain/aggregate";
import { isValidOrganizationMembershipState } from "@domain/organization/organization-membership";
import type { OrganizationMembership } from "@domain/organization/organization-membership.types";
import type { Id, Result } from "@shared/kernel";
export class InMemoryOrganizationMembershipRepository implements OrganizationMembershipRepository {
  private readonly values = new Map<string, OrganizationMembership>(); private unavailable = false;
  setUnavailable(value: boolean): void { this.unavailable = value; }
  async create(value: OrganizationMembership): Promise<Result<OrganizationMembership, OrganizationMembershipPersistenceError>> { if(this.unavailable)return fail("unavailable"); if(value.version!==1||!isValidOrganizationMembershipState(value))return fail("invalid_persistence_state"); if(this.values.has(value.id))return fail("duplicate_membership_id"); if([...this.values.values()].some(v=>v.organizationId===value.organizationId&&v.personId===value.personId))return fail("duplicate_membership"); this.values.set(value.id,{...value}); return {ok:true,value:{...value}}; }
  async save(value: OrganizationMembership, expectedVersion: AggregateVersion): Promise<Result<OrganizationMembership, OrganizationMembershipPersistenceError>> { if(this.unavailable)return fail("unavailable"); if(!isValidOrganizationMembershipState(value)||value.version!==expectedVersion+1)return fail("invalid_persistence_state"); const current=this.values.get(value.id); if(!current)return fail("not_found"); if(current.version!==expectedVersion)return fail("concurrency_conflict"); if(current.organizationId!==value.organizationId||current.personId!==value.personId||current.createdAt!==value.createdAt)return fail("invalid_persistence_state"); this.values.set(value.id,{...value}); return {ok:true,value:{...value}}; }
  async findById(id:Id<"OrganizationMembership">):Promise<OrganizationMembershipLookupResult>{return this.lookup(this.values.get(id));}
  async findByOrganizationAndPerson(organizationId:Id<"Organization">,personId:Id<"Person">):Promise<OrganizationMembershipLookupResult>{return this.lookup([...this.values.values()].find(v=>v.organizationId===organizationId&&v.personId===personId));}
  async findActiveByPerson(personId:Id<"Person">){if(this.unavailable)return {kind:"unavailable" as const};return {kind:"found" as const,memberships:[...this.values.values()].filter(v=>v.personId===personId&&v.status==="active").map(v=>({...v}))};}
  private lookup(value?:OrganizationMembership):OrganizationMembershipLookupResult{if(this.unavailable)return {kind:"unavailable"}; return value?{kind:"found",membership:{...value}}:{kind:"not_found"};}
}
function fail(kind:OrganizationMembershipPersistenceError["kind"]):Result<never,OrganizationMembershipPersistenceError>{return {ok:false,error:{kind}};}
