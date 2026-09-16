import {INITIAL_AGGREGATE_VERSION} from "@domain/aggregate";
import type {AggregateRoot,AggregateVersion} from "@domain/aggregate";
import type {Id,ISODateString,Result} from "@shared/kernel";

export type ContestResultStatus="draft"|"finalized";
export type ContestResultOutcomeType="winner"|"loser";
export interface ContestResult extends AggregateRoot<"ContestResult">{readonly contestId:Id<"Contest">;readonly status:ContestResultStatus;readonly createdAt:ISODateString;readonly finalizedAt:ISODateString|null;readonly version:AggregateVersion;}
export interface ContestResultOutcome extends AggregateRoot<"ContestResultOutcome">{readonly contestResultId:Id<"ContestResult">;readonly contestParticipantId:Id<"ContestParticipant">;readonly outcome:ContestResultOutcomeType;readonly position:null;readonly createdAt:ISODateString;}
type ValidationError={code:"invalid_contest_result"|"invalid_contest_result_outcome";message:string};
const timestamp=(value:string)=>value.trim()!==""&&!Number.isNaN(Date.parse(value));
export function createContestResult(i:{id:Id<"ContestResult">;contestId:Id<"Contest">;status:ContestResultStatus;createdAt:ISODateString;finalizedAt:ISODateString|null;version?:number}):Result<ContestResult,ValidationError>{
 const version=i.version??INITIAL_AGGREGATE_VERSION;
 if(!i.id.trim()||!i.contestId.trim()||(i.status!=="draft"&&i.status!=="finalized")||!timestamp(i.createdAt)||!Number.isInteger(version)||version<1||i.status==="finalized"&&(!i.finalizedAt||!timestamp(i.finalizedAt))||i.status==="draft"&&i.finalizedAt!==null)return{ok:false,error:{code:"invalid_contest_result",message:"Valid result identity, lifecycle, timestamps, and version are required."}};
 return{ok:true,value:{id:i.id,contestId:i.contestId,status:i.status,createdAt:i.createdAt,finalizedAt:i.finalizedAt,version:version as AggregateVersion}};
}
export function createContestResultOutcome(i:{id:Id<"ContestResultOutcome">;contestResultId:Id<"ContestResult">;contestParticipantId:Id<"ContestParticipant">;outcome:ContestResultOutcomeType;createdAt:ISODateString}):Result<ContestResultOutcome,ValidationError>{
 if(!i.id.trim()||!i.contestResultId.trim()||!i.contestParticipantId.trim()||(i.outcome!=="winner"&&i.outcome!=="loser")||!timestamp(i.createdAt))return{ok:false,error:{code:"invalid_contest_result_outcome",message:"Valid outcome identity, participant, type, and timestamp are required."}};
 return{ok:true,value:{...i,position:null,version:INITIAL_AGGREGATE_VERSION}};
}
