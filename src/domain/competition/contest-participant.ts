import {INITIAL_AGGREGATE_VERSION} from "@domain/aggregate";
import type {AggregateRoot} from "@domain/aggregate";
import type {Id,ISODateString,Result} from "@shared/kernel";

type SeedProvenance={readonly sourceType:"seed";readonly sourceSeedNumber:number};
type OutcomeProvenance={readonly sourceType:"contest_outcome";readonly sourceContestResultId:Id<"ContestResult">;readonly sourceOutcome:"winner"|"loser"};
export type ContestParticipant=AggregateRoot<"ContestParticipant">&{readonly contestId:Id<"Contest">;readonly position:number;readonly competitionEntryId:Id<"CompetitionEntry">;readonly createdAt:ISODateString}&(SeedProvenance|OutcomeProvenance);
type Input={id:Id<"ContestParticipant">;contestId:Id<"Contest">;position:number;competitionEntryId:Id<"CompetitionEntry">;now:ISODateString}&({sourceType:"seed";sourceSeedNumber:number}|{sourceType:"contest_outcome";sourceContestResultId:Id<"ContestResult">;sourceOutcome:"winner"|"loser"});
export function createContestParticipant(i:Input):Result<ContestParticipant>{
 const base=!i.id.trim()||!i.contestId.trim()||!i.competitionEntryId.trim()||!Number.isInteger(i.position)||i.position<1||!i.now.trim();
 const provenance=i.sourceType==="seed"?Number.isInteger(i.sourceSeedNumber)&&i.sourceSeedNumber>0:!!i.sourceContestResultId.trim()&&(i.sourceOutcome==="winner"||i.sourceOutcome==="loser");
 if(base||!provenance)return{ok:false,error:{code:"invalid_contest_participant",message:"Valid identifiers, position, provenance, and timestamp are required."}};
 const common={id:i.id,contestId:i.contestId,position:i.position,competitionEntryId:i.competitionEntryId,createdAt:i.now,version:INITIAL_AGGREGATE_VERSION};
 return i.sourceType==="seed"?{ok:true,value:{...common,sourceType:"seed",sourceSeedNumber:i.sourceSeedNumber}}:{ok:true,value:{...common,sourceType:"contest_outcome",sourceContestResultId:i.sourceContestResultId,sourceOutcome:i.sourceOutcome}};
}
