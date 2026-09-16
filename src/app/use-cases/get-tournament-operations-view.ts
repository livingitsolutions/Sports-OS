import type {TournamentOperationsPhase,TournamentOperationsReader,TournamentOperationsSnapshot,TournamentOperationsView} from "@app/contracts/tournament-operations-reader";
import type {AuthorizeOrganizationPermission} from "@app/use-cases/authorize-organization-permission";
import type {Result} from "@shared/kernel";

export type GetTournamentOperationsViewError={kind:"not_found"|"unsupported_operations_format"|"forbidden"|"persistence_unavailable";code:string;message:string};
const fail=(kind:GetTournamentOperationsViewError["kind"]):Result<never,GetTournamentOperationsViewError>=>({ok:false,error:{kind,code:kind,message:kind}});
export class GetTournamentOperationsView{
 constructor(private readonly d:{reader:TournamentOperationsReader;authorization:AuthorizeOrganizationPermission}){}
 async execute(input:{actingMembershipId:string;competitionFormatId:string}):Promise<Result<{view:TournamentOperationsView},GetTournamentOperationsViewError>>{
  const read=await this.d.reader.read(input.competitionFormatId.trim());
  if(read.kind!=="found")return fail(read.kind==="unavailable"?"persistence_unavailable":read.kind);
  const auth=await this.d.authorization.execute({organizationId:read.snapshot.organizationId,membershipId:input.actingMembershipId,permission:"organization.events.read"});
  if(!auth.ok)return fail("persistence_unavailable");
  if(!auth.value.allowed)return fail("forbidden");
  return{ok:true,value:{view:{...read.snapshot,phase:deriveTournamentOperationsPhase(read.snapshot)}}};
 }
}

/** Deterministic precedence: outcome; terminal progression; any consumed progression;
 * playable materialization; seed completeness; materialization; setup. */
export function deriveTournamentOperationsPhase(s:TournamentOperationsSnapshot):TournamentOperationsPhase{
 if(s.outcome)return"completed";
 if(s.contests.some(c=>c.progressionState==="terminal_progressed"))return"final_pending";
 if(s.contests.some(c=>c.progressionState==="progressed"))return"in_progress";
 if(s.seeding.finalized&&s.stages.some(stage=>stage.contests.some(c=>c.participants.length>0)))return"ready";
 if(s.seeding.finalized||s.seeding.assignedCount>0)return"seeding";
 if(s.entrantCount!==undefined)return"awaiting_seeding";
 return"setup";
}
