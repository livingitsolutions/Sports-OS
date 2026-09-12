import type {Id,ISODateString,Result} from "@shared/kernel";
export type CompetitionSeedFinalizationError={kind:"already_finalized"|"seeding_incomplete"|"entrant_set_changed"|"not_materialized"|"unavailable";detail?:string};
export interface CompetitionSeedFinalizer{finalize(input:{competitionFormatId:Id<"CompetitionFormat">;expectedEntryIds:readonly Id<"CompetitionEntry">[];expectedSeedNumbers:readonly number[];finalizedAt:ISODateString}):Promise<Result<{finalizedAt:ISODateString},CompetitionSeedFinalizationError>>;}
