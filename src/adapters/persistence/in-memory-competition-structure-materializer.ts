import type { CompetitionStructureMaterializer } from "@app/contracts";
import type { Contest,Stage } from "@domain/competition/competition.types";
export class InMemoryCompetitionStructureMaterializer implements CompetitionStructureMaterializer{
 private claims=new Map<string,number>();readonly stages=new Map<string,Stage>();readonly contests=new Map<string,Contest>();failContestInsert=false;
 async isMaterialized(id:string){return{ok:true as const,value:this.claims.has(id)};}
 async findEntrantCount(id:string){return{ok:true as const,value:this.claims.get(id)??null};}
 async materialize(i:Parameters<CompetitionStructureMaterializer["materialize"]>[0]){if(this.claims.has(i.format.id))return{ok:false as const,error:{kind:"already_materialized" as const}};if(this.failContestInsert)return{ok:false as const,error:{kind:"unavailable" as const}};this.claims.set(i.format.id,i.entrantCount);for(const x of i.stages)this.stages.set(x.id,x);for(const x of i.contests)this.contests.set(x.id,x);return{ok:true as const,value:{stages:i.stages,contests:i.contests}};}
}
