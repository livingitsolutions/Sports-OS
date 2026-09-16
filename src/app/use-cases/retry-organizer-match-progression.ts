import {selectOrganizerMembership,type GetOrganizerContext,type OrganizerContextError} from "@app/use-cases/get-organizer-context";
import type {ProgressFinalizedContestResult,ProgressFinalizedContestResultError} from "@app/use-cases/progress-finalized-contest-result";
import type {Result} from "@shared/kernel";

export type RetryOrganizerMatchProgressionError=OrganizerContextError|ProgressFinalizedContestResultError;

/** Authenticated recovery facade. All targets and participants remain server-derived. */
export class RetryOrganizerMatchProgression{
 constructor(private readonly d:{organizerContext:GetOrganizerContext;progress:ProgressFinalizedContestResult}){}
 async execute(input:{organizationId:string;contestResultId:string}):Promise<Result<{contestResultId:string;progression:"progressed"|"already_progressed"},RetryOrganizerMatchProgressionError>>{
  const context=await this.d.organizerContext.execute();if(!context.ok)return context;
  const selected=selectOrganizerMembership(context.value,input.organizationId);if(!selected.ok)return selected;
  const progressed=await this.d.progress.execute({actingMembershipId:selected.value.membershipId,contestResultId:input.contestResultId});
  if(!progressed.ok){if(progressed.error.kind==="result_already_progressed")return{ok:true,value:{contestResultId:input.contestResultId,progression:"already_progressed"}};return progressed;}
  return{ok:true,value:{contestResultId:progressed.value.contestResultId,progression:"progressed"}};
 }
}
