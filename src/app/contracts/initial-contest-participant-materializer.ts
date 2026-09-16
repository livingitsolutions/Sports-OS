import type {ContestParticipant} from "@domain/competition/contest-participant";
import type {Id,ISODateString,Result} from "@shared/kernel";
export interface InitialParticipantPlacement{readonly contestPlanRef:string;readonly participant:Omit<ContestParticipant,"contestId">;}
export type InitialParticipantMaterializationError={kind:"seeding_not_finalized"|"participants_already_materialized"|"invalid_finalized_seed_map"|"invalid_contest_mapping"|"invalid_contest_state"|"unavailable";detail?:string};
export interface InitialContestParticipantMaterializer{materialize(input:{competitionFormatId:Id<"CompetitionFormat">;expectedEntrantCount:number;placements:readonly InitialParticipantPlacement[];materializedAt:ISODateString}):Promise<Result<readonly ContestParticipant[],InitialParticipantMaterializationError>>;}
