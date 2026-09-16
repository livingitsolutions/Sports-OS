import {selectOrganizerMembership,type GetOrganizerContext,type OrganizerContextError} from "@app/use-cases/get-organizer-context";
import type {FinalizeCompetitionOutcome,FinalizeCompetitionOutcomeError} from "@app/use-cases/finalize-competition-outcome";
import type {Result} from "@shared/kernel";

export type FinalizeOrganizerCompetitionOutcomeError=OrganizerContextError|FinalizeCompetitionOutcomeError;
export class FinalizeOrganizerCompetitionOutcome{
 constructor(private readonly d:{organizerContext:GetOrganizerContext;finalizeOutcome:FinalizeCompetitionOutcome}){}
 async execute(input:{organizationId:string;competitionFormatId:string}):Promise<Result<{competitionOutcomeId:string},FinalizeOrganizerCompetitionOutcomeError>>{
  const context=await this.d.organizerContext.execute();if(!context.ok)return context;
  const selected=selectOrganizerMembership(context.value,input.organizationId);if(!selected.ok)return selected;
  const result=await this.d.finalizeOutcome.execute({actingMembershipId:selected.value.membershipId,competitionFormatId:input.competitionFormatId});
  return result.ok?{ok:true,value:{competitionOutcomeId:result.value.outcome.id}}:result;
 }
}
