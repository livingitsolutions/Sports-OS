import type { TeamRosterMembershipLookup, TeamRosterMembershipPersistenceError, TeamRosterMembershipRepository } from "@app/contracts/team-roster-membership-repository";
import type { TeamRosterMembership } from "@domain/team/team-roster-membership.types";
import type { Id, Result } from "@shared/kernel";

export class InMemoryTeamRosterMembershipRepository implements TeamRosterMembershipRepository {
  private rows=new Map<string,TeamRosterMembership>();
  async create(m:TeamRosterMembership):Promise<Result<TeamRosterMembership,TeamRosterMembershipPersistenceError>>{if(this.rows.has(m.id))return bad("duplicate_roster_membership_id");if([...this.rows.values()].some(x=>x.teamId===m.teamId&&x.athleteProfileId===m.athleteProfileId&&x.status==="active"))return bad("already_active");this.rows.set(m.id,m);return {ok:true,value:m};}
  async save(m:TeamRosterMembership,expectedVersion:number):Promise<Result<TeamRosterMembership,TeamRosterMembershipPersistenceError>>{const current=this.rows.get(m.id);if(!current)return bad("roster_membership_not_found");if(current.version!==expectedVersion||m.version!==expectedVersion+1)return bad("concurrency_conflict");this.rows.set(m.id,m);return {ok:true,value:m};}
  async findById(id:Id<"TeamRosterMembership">):Promise<TeamRosterMembershipLookup>{const membership=this.rows.get(id);return membership?{kind:"found",membership}:{kind:"not_found"};}
  async findActiveByTeamAndAthlete(teamId:Id<"Team">,athleteProfileId:Id<"AthleteProfile">):Promise<TeamRosterMembershipLookup>{const membership=[...this.rows.values()].find(x=>x.teamId===teamId&&x.athleteProfileId===athleteProfileId&&x.status==="active");return membership?{kind:"found",membership}:{kind:"not_found"};}
  async listByTeam(teamId:Id<"Team">):Promise<readonly TeamRosterMembership[]>{return [...this.rows.values()].filter(x=>x.teamId===teamId);}
}
function bad(kind:TeamRosterMembershipPersistenceError["kind"]):Result<never,TeamRosterMembershipPersistenceError>{return {ok:false,error:{kind}};}
