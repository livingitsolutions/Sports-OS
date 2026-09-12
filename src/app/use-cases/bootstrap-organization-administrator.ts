import type { AppError,Clock,IdGenerator,IntegrationEventPublisher,OrganizationBootstrapGraph,OrganizationBootstrapPrincipalValidator,OrganizationBootstrapRepository,TrustedOrganizationBootstrapper,UseCase } from "@app/contracts";
import type { Id,Result } from "@shared/kernel";
export const ORGANIZATION_ADMIN_ROLE_KEY="organization-admin";
export interface BootstrapOrganizationAdministratorInput{organizationId:string;personId:string;principal:TrustedOrganizationBootstrapper;}
export interface BootstrapOrganizationAdministratorError extends AppError{kind:"invalid_input"|"invalid_trusted_principal"|"organization_not_found"|"person_not_found"|"bootstrap_already_established"|"persistence_unavailable"|"invalid_persistence_state"|"concurrency_conflict";}
export class BootstrapOrganizationAdministrator implements UseCase<BootstrapOrganizationAdministratorInput,OrganizationBootstrapGraph>{
  constructor(private d:{repository:OrganizationBootstrapRepository;principalValidator:OrganizationBootstrapPrincipalValidator;idGenerator:IdGenerator;clock:Clock;integrationEvents:IntegrationEventPublisher}){}
  async execute(input:BootstrapOrganizationAdministratorInput):Promise<Result<OrganizationBootstrapGraph,BootstrapOrganizationAdministratorError>>{
    if(!this.d.principalValidator.isValid(input.principal))return fail("invalid_trusted_principal","A trusted Organization bootstrap principal is required.");
    const organizationId=input.organizationId.trim() as Id<"Organization">,personId=input.personId.trim() as Id<"Person">;
    if(!organizationId||!personId)return fail("invalid_input","Organization and Person identifiers are required.");
    const result=await this.d.repository.bootstrap({organizationId,personId,membershipId:this.d.idGenerator.next("OrganizationMembership"),roleId:this.d.idGenerator.next("OrganizationRole"),assignmentId:this.d.idGenerator.next("OrganizationRoleAssignment"),now:this.d.clock.now()});
    if(!result.ok)return fail(map(result.error.kind),"Organization bootstrap could not be completed.");
    if(result.value.established)await this.d.integrationEvents.publish({eventId:this.d.idGenerator.next("IntegrationEvent"),occurredAt:this.d.clock.now(),eventType:"organization.bootstrap_completed",source:"organization",version:1,payload:{organizationId,membershipId:result.value.membershipId,roleId:result.value.roleId,assignmentId:result.value.assignmentId,principal:{type:input.principal.type,subject:input.principal.subject}}});
    return result;
  }
}
function map(k:string):BootstrapOrganizationAdministratorError["kind"]{return k==="unavailable"?"persistence_unavailable":k as BootstrapOrganizationAdministratorError["kind"];}
function fail(kind:BootstrapOrganizationAdministratorError["kind"],message:string):Result<never,BootstrapOrganizationAdministratorError>{return {ok:false,error:{kind,code:kind,message}};}
