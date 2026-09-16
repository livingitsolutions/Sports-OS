import type {GetTournamentOperationsView,GetTournamentOperationsViewError} from "@app/use-cases/get-tournament-operations-view";
import {selectOrganizerMembership,type GetOrganizerContext,type OrganizerContextError} from "@app/use-cases/get-organizer-context";
import type {TournamentOperationsView} from "@app/contracts";
import type {Result} from "@shared/kernel";

export type AuthenticatedTournamentOperationsError=OrganizerContextError|GetTournamentOperationsViewError;
export class GetAuthenticatedTournamentOperationsView{
 constructor(private readonly d:{organizerContext:GetOrganizerContext;tournamentOperations:GetTournamentOperationsView}){}
 async execute(input:{competitionFormatId:string;organizationId:string}):Promise<Result<{view:TournamentOperationsView},AuthenticatedTournamentOperationsError>>{
  const context=await this.d.organizerContext.execute();
  if(!context.ok)return context;
  const selected=selectOrganizerMembership(context.value,input.organizationId);
  if(!selected.ok)return selected;
  return this.d.tournamentOperations.execute({competitionFormatId:input.competitionFormatId,actingMembershipId:selected.value.membershipId});
 }
}
