import type { CompetitionStructureMaterializer } from "@app/contracts";
import type { Contest,Stage } from "@domain/competition/competition.types";
export class InMemoryCompetitionStructureMaterializer implements CompetitionStructureMaterializer{
 private claims=new Map<string,{entrantCount:number;seedFinalizedAt:string|null}>();readonly stages=new Map<string,Stage>();readonly contests=new Map<string,Contest>();failContestInsert=false;
 async isMaterialized(id:string){return{ok:true as const,value:this.claims.has(id)};}
 async findEntrantCount(id:string){return{ok:true as const,value:this.claims.get(id)?.entrantCount??null};}
 async findState(id:string){const x=this.claims.get(id);return{ok:true as const,value:x?{competitionFormatId:id as never,entrantCount:x.entrantCount,seedFinalizedAt:x.seedFinalizedAt as never}:null};}
 async materialize(i:Parameters<CompetitionStructureMaterializer["materialize"]>[0]){if(this.claims.has(i.format.id))return{ok:false as const,error:{kind:"already_materialized" as const}};if(this.failContestInsert)return{ok:false as const,error:{kind:"unavailable" as const}};this.claims.set(i.format.id,{entrantCount:i.entrantCount,seedFinalizedAt:null});for(const x of i.stages)this.stages.set(x.id,x);for(const x of i.contests)this.contests.set(x.id,x);return{ok:true as const,value:{stages:i.stages,contests:i.contests}};}
 finalizeSeeds(id:string,at:string){const x=this.claims.get(id);if(!x||x.seedFinalizedAt)return false;x.seedFinalizedAt=at;return true;}
 isSeedFinalized(id:string){return Boolean(this.claims.get(id)?.seedFinalizedAt);}
}
