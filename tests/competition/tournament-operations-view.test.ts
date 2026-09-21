import {describe,expect,it} from "vitest";
import {InMemoryTournamentOperationsReader} from "../../src/adapters/persistence/in-memory-tournament-operations-reader";
import type {TournamentOperationsSnapshot,TournamentContestView} from "../../src/app/contracts/tournament-operations-reader";
import {deriveTournamentOperationsPhase,GetTournamentOperationsView} from "../../src/app/use-cases/get-tournament-operations-view";
import type {AuthorizeOrganizationPermission} from "../../src/app/use-cases/authorize-organization-permission";
import {createTestContainer} from "../../src/composition/test";

const contest=(progressionState:TournamentContestView["progressionState"],participants=0):TournamentContestView=>({contestId:"contest-1",planRef:"r1-m1",stageId:"stage-1",sequence:1,status:"pending",capacity:2,participants:Array.from({length:participants},(_,i)=>({contestParticipantId:`p${i}`,position:i+1,competitionEntryId:`entry-${i}`,sourceType:"seed",sourceSeedNumber:i+1})),progressionState});
const snapshot=(change:Partial<TournamentOperationsSnapshot>={}):TournamentOperationsSnapshot=>({competitionFormatId:"format-1",competitionId:"competition-1",eventId:"event-1",organizationId:"org-1",sportId:"sport-1",formatKind:"single_elimination",competitionStatus:"active",formatStatus:"active",entrants:[],seeding:{finalized:false,assignedCount:0,assignments:[]},stages:[],contests:[],...change});
const auth=(allowed:boolean)=>({execute:async()=>({ok:true as const,value:{allowed}})}) as unknown as AuthorizeOrganizationPermission;

describe("Tournament Operations application view",()=>{
 it("resolves through the application composition boundary",async()=>{
  const container=createTestContainer();expect(container.useCases.getTournamentOperationsView).toBeInstanceOf(GetTournamentOperationsView);expect(await container.useCases.getTournamentOperationsView.execute({actingMembershipId:"member",competitionFormatId:"missing"})).toMatchObject({ok:false,error:{kind:"not_found"}});
 });
 it("derives every phase with deterministic precedence",()=>{
  expect(deriveTournamentOperationsPhase(snapshot())).toBe("setup");
  expect(deriveTournamentOperationsPhase(snapshot({entrantCount:6,seeding:{frozenEntrantCount:6,finalized:false,assignedCount:0,assignments:[]}}))).toBe("awaiting_seeding");
  expect(deriveTournamentOperationsPhase(snapshot({entrantCount:6,seeding:{frozenEntrantCount:6,finalized:false,assignedCount:2,assignments:[{seedNumber:1,competitionEntryId:"e1"},{seedNumber:2,competitionEntryId:"e2"}]}}))).toBe("seeding");
  const readyContest=contest("awaiting_result",1);expect(deriveTournamentOperationsPhase(snapshot({entrantCount:6,seeding:{frozenEntrantCount:6,finalized:true,finalizedAt:"2026-01-01T00:00:00.000Z",assignedCount:6,assignments:[]},stages:[{stageId:"stage-1",sequence:1,status:"pending",contests:[readyContest]}],contests:[readyContest]}))).toBe("ready");
  expect(deriveTournamentOperationsPhase(snapshot({contests:[contest("progressed")]}))).toBe("in_progress");
  expect(deriveTournamentOperationsPhase(snapshot({contests:[contest("progressed"),contest("terminal_progressed")]}))).toBe("final_pending");
  expect(deriveTournamentOperationsPhase(snapshot({contests:[contest("terminal_progressed")],outcome:{competitionOutcomeId:"outcome-1",finalizedAt:"2026-01-01T00:00:00.000Z",placements:[]}}))).toBe("completed");
 });
 it("requires the exact read authorization result",async()=>{
  const reader=new InMemoryTournamentOperationsReader([snapshot()]);
  expect((await new GetTournamentOperationsView({reader,authorization:auth(true)}).execute({actingMembershipId:"member",competitionFormatId:"format-1"})).ok).toBe(true);
  const denied=await new GetTournamentOperationsView({reader,authorization:auth(false)}).execute({actingMembershipId:"member",competitionFormatId:"format-1"});expect(denied).toMatchObject({ok:false,error:{kind:"forbidden"}});
 });
 it("reports missing and unsupported formats without leaking a projection",async()=>{
  const reader=new InMemoryTournamentOperationsReader();expect(await reader.read("missing")).toEqual({kind:"not_found"});
  reader.put({...snapshot(),formatKind:"round_robin"});expect(await reader.read("format-1")).toEqual({kind:"unsupported_operations_format"});
 });
 it("preserves deterministic structural ordering and byes",()=>{
  const assignments=[{seedNumber:1,competitionEntryId:"e1"},{seedNumber:2,competitionEntryId:"e2"}];const bye=contest("awaiting_result",1);const value=snapshot({seeding:{frozenEntrantCount:6,finalized:false,assignedCount:2,assignments},stages:[{stageId:"stage-1",sequence:1,status:"pending",contests:[bye]}],contests:[bye]});
  expect(value.seeding.assignments.map(a=>a.seedNumber)).toEqual([1,2]);expect(value.contests[0]?.planRef).toBe("r1-m1");expect(value.contests[0]?.participants).toHaveLength(1);expect(value.contests[0]?.capacity).toBe(2);
 });
 it("preserves entrant identity descriptors through the in-memory reader",async()=>{
  const value=snapshot({entrants:[{competitionEntryId:"entry-team",entrantType:"team",identityStatus:"resolved",displayName:"Harbor Lions"},{competitionEntryId:"entry-missing",entrantType:"unknown",identityStatus:"unavailable"}]});
  const reader=new InMemoryTournamentOperationsReader([value]);const result=await reader.read("format-1");expect(result).toMatchObject({kind:"found",snapshot:{entrants:value.entrants}});
 });
});
