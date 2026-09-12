import type { CompetitionFormatPlan } from "@domain/competition/competition-format-engine";
import type { Result } from "@shared/kernel";
export type FormatPlanValidationError={kind:"invalid_format_plan";code:"invalid_format_plan";message:string};
const bad=(message:string):Result<never,FormatPlanValidationError>=>({ok:false,error:{kind:"invalid_format_plan",code:"invalid_format_plan",message}});
export function validateCompetitionFormatPlan(plan:CompetitionFormatPlan):Result<void,FormatPlanValidationError>{
 if(!plan.stages.length)return bad("The plan must contain at least one Stage.");
 const sr=new Set<string>(),ss=new Set<number>();
 for(const s of plan.stages){if(!s.ref||sr.has(s.ref))return bad("Stage refs must be non-empty and unique.");if(!Number.isInteger(s.sequence)||s.sequence<1||ss.has(s.sequence))return bad("Stage sequences must be positive and unique.");sr.add(s.ref);ss.add(s.sequence);}
 const cr=new Set<string>(),byStage=new Map<string,Set<number>>(),capacities=new Map<string,number>();
 for(const c of plan.contests){if(!c.ref||cr.has(c.ref))return bad("Contest refs must be non-empty and unique.");if(!sr.has(c.stageRef))return bad("Every Contest must reference an existing Stage.");const seq=byStage.get(c.stageRef)??new Set<number>();if(!Number.isInteger(c.sequence)||c.sequence<1||seq.has(c.sequence))return bad("Contest sequences must be positive and unique within a Stage.");if(!Number.isInteger(c.capacity)||c.capacity<1)return bad("Contest capacity must be positive.");cr.add(c.ref);seq.add(c.sequence);byStage.set(c.stageRef,seq);capacities.set(c.ref,c.capacity);}
 const targets=new Set<string>();
 for(const r of plan.progressionRules){const s=r.source;if(s.type==="contest_outcome"&&!cr.has(s.contestRef))return bad("Progression source Contest ref is dangling.");if(s.type==="stage_standing"&&(!sr.has(s.stageRef)||!Number.isInteger(s.position)||s.position<1))return bad("Progression source Stage ref or position is invalid.");if(s.type==="seed"&&(!Number.isInteger(s.seedNumber)||s.seedNumber<1))return bad("Progression seed source is invalid.");const cap=capacities.get(r.target.contestRef);if(cap===undefined)return bad("Progression target Contest ref is dangling.");if(!Number.isInteger(r.target.position)||r.target.position<1||r.target.position>cap)return bad("Progression target position is invalid.");const key=`${r.target.contestRef}:${r.target.position}`;if(targets.has(key))return bad("Progression target position is assigned more than once.");targets.add(key);}
 return{ok:true,value:undefined};
}
