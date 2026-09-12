import { INITIAL_AGGREGATE_VERSION, nextAggregateVersion } from "@domain/aggregate";
import type { AggregateRoot, AggregateVersion, DomainEvent } from "@domain/aggregate";
import type { DomainError, Id, ISODateString, Result } from "@shared/kernel";

export const COMPETITION_FORMAT_KINDS = ["single_elimination","double_elimination","round_robin","groups_knockout","swiss","league","ladder"] as const;
export type CompetitionFormatKind = typeof COMPETITION_FORMAT_KINDS[number];
export type CompetitionFormatStatus = "active" | "retired";
export interface CompetitionFormat extends AggregateRoot<"CompetitionFormat"> { readonly competitionId:Id<"Competition">; readonly divisionId:Id<"Division">|null; readonly kind:CompetitionFormatKind; readonly status:CompetitionFormatStatus; readonly createdAt:ISODateString; readonly updatedAt:ISODateString; }
export interface CompetitionFormatEvent extends DomainEvent { readonly type:"competition.format_created"|"competition.format_retired"; readonly competitionFormatId:Id<"CompetitionFormat">; readonly competitionId:Id<"Competition">; readonly divisionId:Id<"Division">|null; readonly kind:CompetitionFormatKind; readonly version:AggregateVersion; readonly timestamp:ISODateString; }
type Meta={now:ISODateString;domainEventId:string}; type Change={format:CompetitionFormat;event:CompetitionFormatEvent};
const error=(code:string,message:string):DomainError=>({code,message});
export const isCompetitionFormatKind=(value:string):value is CompetitionFormatKind=>(COMPETITION_FORMAT_KINDS as readonly string[]).includes(value);
function event(type:CompetitionFormatEvent["type"],format:CompetitionFormat,m:Meta):CompetitionFormatEvent{return{type,eventId:m.domainEventId,occurredAt:m.now,aggregateId:format.id,aggregateType:"CompetitionFormat",competitionFormatId:format.id,competitionId:format.competitionId,divisionId:format.divisionId,kind:format.kind,version:format.version,timestamp:m.now};}
export function createCompetitionFormat(i:{id:Id<"CompetitionFormat">;competitionId:Id<"Competition">;divisionId?:Id<"Division">|null;kind:string}&Meta):Result<Change>{if(!i.id.trim()||!i.competitionId.trim())return{ok:false,error:error("required_id","CompetitionFormat and Competition identifiers are required.")};if(!isCompetitionFormatKind(i.kind))return{ok:false,error:error("invalid_format_kind","Competition format kind is not supported by the catalog.")};const format:CompetitionFormat={id:i.id,competitionId:i.competitionId,divisionId:i.divisionId??null,kind:i.kind,status:"active",createdAt:i.now,updatedAt:i.now,version:INITIAL_AGGREGATE_VERSION};return{ok:true,value:{format,event:event("competition.format_created",format,i)}};}
export function retireCompetitionFormat(format:CompetitionFormat,m:Meta):Result<Change>{if(format.status==="retired")return{ok:false,error:error("already_retired","CompetitionFormat is already retired.")};const retired={...format,status:"retired" as const,updatedAt:m.now,version:nextAggregateVersion(format.version)};return{ok:true,value:{format:retired,event:event("competition.format_retired",retired,m)}};}

