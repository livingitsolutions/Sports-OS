import type {ContestResult,ContestResultOutcome} from "@domain/competition/contest-result";
import type {Id,Result} from "@shared/kernel";
export type ContestResultLookup={kind:"found";result:ContestResult}|{kind:"not_found"}|{kind:"invalid_persistence_state"|"unavailable";detail?:string};
export interface ContestResultRepository{findById(id:Id<"ContestResult">):Promise<ContestResultLookup>;findByContestId(id:Id<"Contest">):Promise<ContestResultLookup>;listOutcomes(id:Id<"ContestResult">):Promise<Result<readonly ContestResultOutcome[],{kind:"invalid_persistence_state"|"unavailable";detail?:string}>>;}
export type ContestResultRecordingError={kind:"result_already_finalized"|"contest_not_ready"|"unsupported_result_structure"|"invalid_participants"|"parent_not_found"|"invalid_persistence_state"|"unavailable";detail?:string};
export interface ContestResultRecorder{record(i:{result:ContestResult;outcomes:readonly [ContestResultOutcome,ContestResultOutcome];winnerContestParticipantId:Id<"ContestParticipant">;loserContestParticipantId:Id<"ContestParticipant">}):Promise<Result<{result:ContestResult;outcomes:readonly ContestResultOutcome[]},ContestResultRecordingError>>;}
