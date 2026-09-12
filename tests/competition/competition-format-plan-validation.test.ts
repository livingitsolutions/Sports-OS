import {describe,expect,it} from "vitest";
import {validateCompetitionFormatPlan} from "@domain/competition/competition-format-plan-validation";
import type {CompetitionFormatPlan,PlannedContest,PlannedProgressionRule,PlannedStage} from "@domain/competition/competition-format-engine";
const base=():CompetitionFormatPlan=>({stages:[{ref:"s1",sequence:1,key:"one"}],contests:[{ref:"c1",stageRef:"s1",sequence:1,capacity:2}],progressionRules:[{source:{type:"seed",seedNumber:1},target:{contestRef:"c1",position:1}}]});
type MutablePlan={stages:PlannedStage[];contests:PlannedContest[];progressionRules:PlannedProgressionRule[]};
const mutable=():MutablePlan=>({stages:[...base().stages],contests:[...base().contests],progressionRules:[...base().progressionRules]});
const rejects=(change:(p:MutablePlan)=>void)=>{const p=mutable();change(p);expect(validateCompetitionFormatPlan(p)).toMatchObject({ok:false,error:{kind:"invalid_format_plan"}});};
describe("CompetitionFormatPlan structural validation",()=>{
 it("accepts a structurally complete plan",()=>expect(validateCompetitionFormatPlan(base())).toEqual({ok:true,value:undefined}));
 it("rejects duplicate Stage refs",()=>rejects(p=>p.stages.push({...p.stages[0],sequence:2})));
 it("rejects duplicate Stage sequences",()=>rejects(p=>p.stages.push({...p.stages[0],ref:"s2"})));
 it("rejects dangling Contest Stage refs",()=>rejects(p=>p.contests[0]={...p.contests[0]!,stageRef:"missing"}));
 it("rejects duplicate Contest refs",()=>rejects(p=>p.contests.push({...p.contests[0],sequence:2})));
 it("rejects duplicate Contest sequences within a Stage",()=>rejects(p=>p.contests.push({...p.contests[0],ref:"c2"})));
 it("rejects invalid capacity",()=>rejects(p=>p.contests[0]={...p.contests[0]!,capacity:0}));
 it("rejects dangling progression refs",()=>rejects(p=>p.progressionRules[0]={...p.progressionRules[0]!,source:{type:"contest_outcome",contestRef:"missing",outcome:"winner"}}));
 it("rejects invalid target positions",()=>rejects(p=>p.progressionRules[0]={...p.progressionRules[0]!,target:{...p.progressionRules[0]!.target,position:3}}));
 it("rejects duplicate target assignments",()=>rejects(p=>p.progressionRules.push({...p.progressionRules[0]!})));
});
