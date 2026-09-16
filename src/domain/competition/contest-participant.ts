import {INITIAL_AGGREGATE_VERSION} from "@domain/aggregate";
import type {AggregateRoot} from "@domain/aggregate";
import type {Id,ISODateString,Result} from "@shared/kernel";

export interface ContestParticipant extends AggregateRoot<"ContestParticipant">{readonly contestId:Id<"Contest">;readonly position:number;readonly competitionEntryId:Id<"CompetitionEntry">;readonly sourceType:"seed";readonly sourceSeedNumber:number;readonly createdAt:ISODateString;}
export function createContestParticipant(i:{id:Id<"ContestParticipant">;contestId:Id<"Contest">;position:number;competitionEntryId:Id<"CompetitionEntry">;sourceType:"seed";sourceSeedNumber:number;now:ISODateString}):Result<ContestParticipant>{
 if(!i.id.trim()||!i.contestId.trim()||!i.competitionEntryId.trim()||!Number.isInteger(i.position)||i.position<1||i.sourceType!=="seed"||!Number.isInteger(i.sourceSeedNumber)||i.sourceSeedNumber<1||!i.now.trim())return{ok:false,error:{code:"invalid_contest_participant",message:"Valid identifiers, position, seed provenance, and timestamp are required."}};
 return{ok:true,value:{id:i.id,contestId:i.contestId,position:i.position,competitionEntryId:i.competitionEntryId,sourceType:"seed",sourceSeedNumber:i.sourceSeedNumber,createdAt:i.now,version:INITIAL_AGGREGATE_VERSION}};
}
