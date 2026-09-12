import type { CompetitionStructureMaterializer,CompetitionStructureMaterializationError } from "@app/contracts";
import type { Sql } from "@adapters/persistence/pg/connection";
import { isUniqueViolation,neutralDetail,pgErrorInfo } from "@adapters/persistence/pg/errors";
import type { Result } from "@shared/kernel";
const bad=(kind:CompetitionStructureMaterializationError["kind"],detail?:string):Result<never,CompetitionStructureMaterializationError>=>({ok:false,error:{kind,...(detail?{detail}:{})}});
export class PgCompetitionStructureMaterializer implements CompetitionStructureMaterializer{
 constructor(private readonly sql:Sql){}
 async isMaterialized(id:string){try{const rows=await this.sql<{exists:boolean}[]>`SELECT EXISTS(SELECT 1 FROM competition_format_materializations WHERE competition_format_id=${id}) AS exists`;return{ok:true as const,value:Boolean(rows[0]?.exists)};}catch(e){return bad("unavailable",neutralDetail(e));}}
 async findEntrantCount(id:string){try{const rows=await this.sql<{entrant_count:number}[]>`SELECT entrant_count FROM competition_format_materializations WHERE competition_format_id=${id}`;return{ok:true as const,value:rows[0]?Number(rows[0].entrant_count):null};}catch(e){return bad("unavailable",neutralDetail(e));}}
 async materialize(i:Parameters<CompetitionStructureMaterializer["materialize"]>[0]){try{
  await this.sql.begin(async tx=>{await tx`INSERT INTO competition_format_materializations(competition_format_id,entrant_count,created_at) VALUES(${i.format.id},${i.entrantCount??2},${i.createdAt})`;
   for(const s of i.stages)await tx`INSERT INTO competition_stages(id,competition_id,division_id,name,key,sequence,status,created_at,updated_at,version,competition_format_id) VALUES(${s.id},${s.competitionId},${s.divisionId},${s.name},${s.key},${s.sequence},${s.status},${s.createdAt},${s.updatedAt},${s.version},${s.competitionFormatId??null})`;
   for(const c of i.contests)await tx`INSERT INTO contests(id,stage_id,sequence,status,scheduled_at,created_at,updated_at,version) VALUES(${c.id},${c.stageId},${c.sequence},${c.status},${c.scheduledAt},${c.createdAt},${c.updatedAt},${c.version})`;
  });return{ok:true as const,value:{stages:i.stages,contests:i.contests}};
 }catch(e){const info=pgErrorInfo(e);return isUniqueViolation(info)&&info?.constraint==="competition_format_materializations_pkey"?bad("already_materialized"):bad("unavailable",neutralDetail(e));}}
}
