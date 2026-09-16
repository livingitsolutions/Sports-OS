import type {AccountRepository,AppError,AuthIdentityProvider,OrganizationMembershipRepository,OrganizationRepository,PersonRepository,UseCase} from "@app/contracts";
import type {Result} from "@shared/kernel";

export interface OrganizerOrganizationContext {readonly organizationId:string;readonly membershipId:string;readonly organizationName:string;}
export interface OrganizerContext {readonly personId:string;readonly organizations:readonly OrganizerOrganizationContext[];}
export type OrganizerContextErrorKind="unauthenticated"|"forbidden"|"identity_provider_unavailable"|"persistence_unavailable";
export interface OrganizerContextError extends AppError {readonly kind:OrganizerContextErrorKind;}

/** Resolves provider-neutral organizer authority from the verified current identity. */
export class GetOrganizerContext implements UseCase<void,OrganizerContext>{
 constructor(private readonly d:{authIdentityProvider:AuthIdentityProvider;accountRepository:AccountRepository;personRepository:PersonRepository;membershipRepository:OrganizationMembershipRepository;organizationRepository:OrganizationRepository}){}
 async execute():Promise<Result<OrganizerContext,OrganizerContextError>>{
  const identity=await this.d.authIdentityProvider.getCurrentIdentity();
  if(identity.kind==="unauthenticated")return fail("unauthenticated");
  if(identity.kind==="unavailable")return fail("identity_provider_unavailable");
  const account=await this.d.accountRepository.findByAuthSubject(identity.identity.subject);
  if(account.kind==="not_found"||account.kind==="found"&&account.account.status!=="active")return fail("forbidden");
  if(account.kind!=="found")return fail("persistence_unavailable");
  const person=await this.d.personRepository.findById(account.account.personId);
  if(person.kind==="not_found"||person.kind==="found"&&person.person.lifecycleStatus!=="active")return fail("forbidden");
  if(person.kind!=="found")return fail("persistence_unavailable");
  const memberships=await this.d.membershipRepository.findActiveByPerson(person.person.id);
  if(memberships.kind!=="found")return fail("persistence_unavailable");
  const organizations:OrganizerOrganizationContext[]=[];
  for(const membership of memberships.memberships){
   const organization=await this.d.organizationRepository.findById(membership.organizationId);
   if(organization.kind==="not_found")continue;
   if(organization.kind!=="found")return fail("persistence_unavailable");
   if(organization.organization.status==="active")organizations.push({organizationId:organization.organization.id,membershipId:membership.id,organizationName:organization.organization.name});
  }
  organizations.sort((a,b)=>a.organizationName.localeCompare(b.organizationName)||a.organizationId.localeCompare(b.organizationId));
  return {ok:true,value:{personId:person.person.id,organizations}};
 }
}
function fail(kind:OrganizerContextErrorKind):Result<never,OrganizerContextError>{return {ok:false,error:{kind,code:kind,message:kind}};}

export function selectOrganizerMembership(context:OrganizerContext,organizationId:string):Result<OrganizerOrganizationContext,OrganizerContextError>{
 const selected=context.organizations.find(item=>item.organizationId===organizationId.trim());
 return selected?{ok:true,value:selected}:fail("forbidden");
}
