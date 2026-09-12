import type { CompetitionFormat } from "@domain/competition/competition-format";
import type { Contest, Stage } from "@domain/competition/competition.types";
import type { ISODateString, Result } from "@shared/kernel";

export type CompetitionStructureMaterializationError={kind:"already_materialized"|"invalid_persistence_state"|"unavailable";detail?:string};
export interface CompetitionStructureMaterializer {
  isMaterialized(formatId:CompetitionFormat["id"]):Promise<Result<boolean,CompetitionStructureMaterializationError>>;
  materialize(input:{format:CompetitionFormat;stages:readonly Stage[];contests:readonly Contest[];createdAt:ISODateString}):Promise<Result<{stages:readonly Stage[];contests:readonly Contest[]},CompetitionStructureMaterializationError>>;
}
