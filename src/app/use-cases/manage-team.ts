import type { AppError, Clock, DomainEventPublisher, IdGenerator, OrganizationRepository, TeamRepository, UseCase } from "@app/contracts";
import { deactivateTeam, reactivateTeam } from "@domain/team/team";
import type { Team } from "@domain/team/team.types";
import type { Id, Result } from "@shared/kernel";
import type { AuthorizeOrganizationPermission } from "@app/use-cases/authorize-organization-permission";

export interface ManageTeamInput { actingMembershipId: string; organizationId: string; teamId: string; }
export interface ManageTeamError extends AppError { kind: "invalid_input" | "forbidden" | "organization_not_found" | "team_not_found" | "team_belongs_to_other_organization" | "invalid_transition" | "concurrency_conflict" | "persistence_unavailable"; }
type Deps = { repository: TeamRepository; organizationRepository: OrganizationRepository; authorization: AuthorizeOrganizationPermission; clock: Clock; idGenerator: IdGenerator; domainEvents: DomainEventPublisher };
abstract class ManageTeam implements UseCase<ManageTeamInput, { team: Team }> {
  constructor(protected readonly d: Deps) {}
  protected abstract change(team: Team, meta: { now: ReturnType<Clock["now"]>; eventId: string }): ReturnType<typeof deactivateTeam>;
  async execute(input: ManageTeamInput): Promise<Result<{ team: Team }, ManageTeamError>> {
    const organizationId=input.organizationId.trim() as Id<"Organization">, teamId=input.teamId.trim() as Id<"Team">, membershipId=input.actingMembershipId.trim();
    if(!organizationId||!teamId||!membershipId)return fail("invalid_input","Organization, Team, and acting membership are required.");
    const org=await this.d.organizationRepository.findById(organizationId); if(org.kind==="not_found")return fail("organization_not_found","Organization does not exist."); if(org.kind!=="found")return fail("persistence_unavailable","Organization lookup failed.");
    const auth=await this.d.authorization.execute({organizationId,membershipId,permission:"organization.teams.manage"}); if(!auth.ok)return fail("persistence_unavailable",auth.error.message); if(!auth.value.allowed)return fail("forbidden","Team management is not permitted.");
    const found=await this.d.repository.findById(teamId); if(found.kind==="not_found")return fail("team_not_found","Team does not exist."); if(found.kind!=="found")return fail("persistence_unavailable","Team lookup failed."); if(found.team.organizationId!==organizationId)return fail("team_belongs_to_other_organization","Team belongs to another Organization.");
    const changed=this.change(found.team,{now:this.d.clock.now(),eventId:this.d.idGenerator.next("DomainEvent")}); if(!changed.ok)return fail("invalid_transition",changed.error.message);
    const saved=await this.d.repository.save(changed.value.team,found.team.version); if(!saved.ok)return fail(saved.error.kind==="concurrency_conflict"?"concurrency_conflict":"persistence_unavailable","Team update failed.");
    await this.d.domainEvents.publish(changed.value.event); return {ok:true,value:{team:saved.value}};
  }
}
export class DeactivateTeam extends ManageTeam { protected change(team: Team, meta: {now: ReturnType<Clock["now"]>;eventId:string}) { return deactivateTeam(team,meta); } }
export class ReactivateTeam extends ManageTeam { protected change(team: Team, meta: {now: ReturnType<Clock["now"]>;eventId:string}) { return reactivateTeam(team,meta); } }
function fail(kind:ManageTeamError["kind"],message:string):Result<never,ManageTeamError>{return {ok:false,error:{kind,code:kind,message}};}
