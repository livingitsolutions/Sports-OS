import type { CompetitionFormat } from "@domain/competition/competition-format";
import type { Contest, Stage } from "@domain/competition/competition.types";
import type { ISODateString, Result } from "@shared/kernel";

export type CompetitionStructureMaterializationError={kind:"already_materialized"|"invalid_persistence_state"|"unavailable";detail?:string};
export interface CompetitionFormatMaterializationState {readonly competitionFormatId:CompetitionFormat["id"];readonly entrantCount:number;readonly seedFinalizedAt:ISODateString|null;readonly participantsMaterializedAt?:ISODateString|null;}
export interface CompetitionStructureMaterializer {
  isMaterialized(formatId:CompetitionFormat["id"]):Promise<Result<boolean,CompetitionStructureMaterializationError>>;
  findEntrantCount(formatId:CompetitionFormat["id"]):Promise<Result<number|null,CompetitionStructureMaterializationError>>;
  findState(formatId:CompetitionFormat["id"]):Promise<Result<CompetitionFormatMaterializationState|null,CompetitionStructureMaterializationError>>;
  materialize(input:{format:CompetitionFormat;entrantCount:number;stages:readonly Stage[];contests:readonly Contest[];createdAt:ISODateString}):Promise<Result<{stages:readonly Stage[];contests:readonly Contest[]},CompetitionStructureMaterializationError>>;
}
