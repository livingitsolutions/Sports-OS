import type { CompetitionFormatKind } from "@domain/competition/competition-format";
import type { Result } from "@shared/kernel";
export interface CompetitionFormatPlanningInput { readonly formatKind:CompetitionFormatKind; readonly entrantCount:number; readonly scope?:Readonly<{competitionRef:string;divisionRef?:string|null}>; }
export interface PlannedStage { readonly ref:string; readonly sequence:number; readonly key:string; readonly metadata?:Readonly<Record<string,string|number|boolean>>; }
export interface PlannedContest { readonly ref:string; readonly stageRef:string; readonly sequence:number; readonly capacity:number; }
export type ProgressionSource={readonly type:"seed";readonly seedNumber:number}|{readonly type:"contest_outcome";readonly contestRef:string;readonly outcome:"winner"|"loser"}|{readonly type:"stage_standing";readonly stageRef:string;readonly position:number};
export interface ProgressionTarget { readonly contestRef:string; readonly position:number; }
export interface PlannedProgressionRule { readonly source:ProgressionSource; readonly target:ProgressionTarget; }
export interface CompetitionFormatPlan { readonly stages:readonly PlannedStage[]; readonly contests:readonly PlannedContest[]; readonly progressionRules:readonly PlannedProgressionRule[]; }
export type PlanningError={kind:"invalid_input";code:string;message:string};
export interface CompetitionFormatEngine { readonly supportedKind:CompetitionFormatKind; validate(input:CompetitionFormatPlanningInput):Result<void,PlanningError>; plan(input:CompetitionFormatPlanningInput):Result<CompetitionFormatPlan,PlanningError>; }
export function validateCompetitionFormatPlanningInput(input:CompetitionFormatPlanningInput):Result<void,PlanningError>{return Number.isInteger(input.entrantCount)&&input.entrantCount>0?{ok:true,value:undefined}:{ok:false,error:{kind:"invalid_input",code:"invalid_entrant_count",message:"entrantCount must be a positive integer."}};}
export type RegistryError={kind:"duplicate_engine"|"unsupported_format";code:string;message:string};
export class CompetitionFormatEngineRegistry { private readonly engines=new Map<CompetitionFormatKind,CompetitionFormatEngine>(); register(engine:CompetitionFormatEngine):Result<void,RegistryError>{if(this.engines.has(engine.supportedKind))return{ok:false,error:{kind:"duplicate_engine",code:"duplicate_engine",message:`An engine is already registered for ${engine.supportedKind}.`}};this.engines.set(engine.supportedKind,engine);return{ok:true,value:undefined};} resolve(kind:CompetitionFormatKind):Result<CompetitionFormatEngine,RegistryError>{const engine=this.engines.get(kind);return engine?{ok:true,value:engine}:{ok:false,error:{kind:"unsupported_format",code:"unsupported_format",message:`No engine is registered for ${kind}.`}};} }

