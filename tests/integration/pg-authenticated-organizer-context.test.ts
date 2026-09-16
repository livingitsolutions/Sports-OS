import postgres from "postgres";
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import type {Sql} from "@adapters";
import {PgAccountRepository,PgOrganizationMembershipRepository,PgOrganizationRepository,PgOrganizationRoleAssignmentRepository,PgOrganizationRoleRepository,PgPersonRepository,PgTournamentOperationsReader} from "@adapters";
import {GetOrganizerContext} from "@app/use-cases/get-organizer-context";
import {GetAuthenticatedTournamentOperationsView} from "@app/use-cases/get-authenticated-tournament-operations-view";
import {GetTournamentOperationsView} from "@app/use-cases/get-tournament-operations-view";
import {AuthorizeOrganizationPermission} from "@app/use-cases/authorize-organization-permission";
import type {AuthSubject} from "@domain/auth/account";

const URL=process.env.TEST_DATABASE_URL??"",RUN=URL.length>0,P=`auth-org-${Date.now()}-${Math.floor(Math.random()*1e6)}`,x=(name:string)=>`${P}-${name}`,NOW="2026-09-16T00:00:00.000Z";
vi.setConfig({testTimeout:120_000,hookTimeout:120_000});
describe.skipIf(!RUN)("PostgreSQL authenticated Organizer Context",()=>{
 let sql:Sql,context:GetOrganizerContext,operations:GetAuthenticatedTournamentOperationsView;
 beforeAll(async()=>{
  sql=postgres(URL,{ssl:"require",max:5,onnotice:()=>{}}) as Sql;
  await sql`INSERT INTO persons(id,display_name,lifecycle_status,created_at,updated_at,version) VALUES(${x("person")},'Verified Organizer','active',${NOW},${NOW},1),(${x("outsider-person")},'Outsider','active',${NOW},${NOW},1)`;
  await sql`INSERT INTO sports_ids(value,person_id,issued_at,status) VALUES(${x("sports-id")},${x("person")},${NOW},'active'),(${x("outsider-sports-id")},${x("outsider-person")},${NOW},'active')`;
  await sql`INSERT INTO accounts(id,auth_subject,person_id,status,version,created_at,updated_at) VALUES(${x("account")},${x("subject")},${x("person")},'active',1,${NOW},${NOW}),(${x("outsider-account")},${x("outsider-subject")},${x("outsider-person")},'active',1,${NOW},${NOW})`;
  await sql`INSERT INTO organizations(id,name,slug,type,status,country_code,version,created_at,updated_at) VALUES(${x("org-a")},'Alpha Athletics',${x("org-a")},'league','active','PH',1,${NOW},${NOW}),(${x("org-b")},'Bay League',${x("org-b")},'league','active','PH',1,${NOW},${NOW}),(${x("org-inactive-member")},'Closed Membership',${x("org-inactive-member")},'league','active','PH',1,${NOW},${NOW}),(${x("org-outsider")},'Outsider League',${x("org-outsider")},'league','active','PH',1,${NOW},${NOW})`;
  await sql`INSERT INTO organization_memberships(id,organization_id,person_id,status,version,created_at,updated_at) VALUES(${x("member-a")},${x("org-a")},${x("person")},'active',1,${NOW},${NOW}),(${x("member-b")},${x("org-b")},${x("person")},'active',1,${NOW},${NOW}),(${x("member-inactive")},${x("org-inactive-member")},${x("person")},'inactive',1,${NOW},${NOW}),(${x("member-outsider")},${x("org-outsider")},${x("outsider-person")},'active',1,${NOW},${NOW})`;
  for(const n of ["a","b"]){
   await sql`INSERT INTO organization_roles(id,organization_id,name,key,permissions,status,version,created_at,updated_at) VALUES(${x(`role-${n}`)},${x(`org-${n}`)},'Event Reader',${x(`role-${n}`)},ARRAY['organization.events.read'],'active',1,${NOW},${NOW})`;
   await sql`INSERT INTO organization_role_assignments(id,organization_id,membership_id,role_id,status,version,created_at,updated_at) VALUES(${x(`assignment-${n}`)},${x(`org-${n}`)},${x(`member-${n}`)},${x(`role-${n}`)},'active',1,${NOW},${NOW})`;
   await sql`INSERT INTO events(id,organization_id,name,key,status,created_at,updated_at,version) VALUES(${x(`event-${n}`)},${x(`org-${n}`)},${`Event ${n}`},${x(`event-${n}`)},'active',${NOW},${NOW},1)`;
   await sql`INSERT INTO competitions(id,event_id,sport_id,name,key,status,created_at,updated_at,version) VALUES(${x(`competition-${n}`)},${x(`event-${n}`)},'sport-basketball',${`Competition ${n}`},${x(`competition-${n}`)},'active',${NOW},${NOW},1)`;
   await sql`INSERT INTO competition_formats(id,competition_id,kind,status,created_at,updated_at,version) VALUES(${x(`format-${n}`)},${x(`competition-${n}`)},'single_elimination','active',${NOW},${NOW},1)`;
  }
  const memberships=new PgOrganizationMembershipRepository(sql),auth={getCurrentIdentity:async()=>({kind:"authenticated" as const,identity:{subject:x("subject") as AuthSubject}})};
  context=new GetOrganizerContext({authIdentityProvider:auth,accountRepository:new PgAccountRepository(sql),personRepository:new PgPersonRepository(sql),membershipRepository:memberships,organizationRepository:new PgOrganizationRepository(sql)});
  const authorization=new AuthorizeOrganizationPermission({membershipRepository:memberships,roleRepository:new PgOrganizationRoleRepository(sql),assignmentRepository:new PgOrganizationRoleAssignmentRepository(sql)});
  operations=new GetAuthenticatedTournamentOperationsView({organizerContext:context,tournamentOperations:new GetTournamentOperationsView({reader:new PgTournamentOperationsReader(sql),authorization})});
 });
 afterAll(async()=>{for(const table of ["competition_formats","competitions","events","organization_role_assignments","organization_roles","organization_memberships","accounts","organizations"])await sql.unsafe(`DELETE FROM ${table} WHERE id LIKE $1`,[`${P}%`]);await sql`DELETE FROM sports_ids WHERE person_id LIKE ${`${P}%`}`;await sql`DELETE FROM persons WHERE id LIKE ${`${P}%`}`;await sql.end({timeout:5});});
 it("B-D resolves Account to Person and excludes inactive membership",async()=>expect(await context.execute()).toEqual({ok:true,value:{personId:x("person"),organizations:[{organizationId:x("org-a"),membershipId:x("member-a"),organizationName:"Alpha Athletics"},{organizationId:x("org-b"),membershipId:x("member-b"),organizationName:"Bay League"}]}}));
 it("I allows either active organization and K rejects a tournament owned by the other",async()=>{expect(await operations.execute({organizationId:x("org-a"),competitionFormatId:x("format-a")})).toMatchObject({ok:true});expect(await operations.execute({organizationId:x("org-b"),competitionFormatId:x("format-b")})).toMatchObject({ok:true});expect(await operations.execute({organizationId:x("org-a"),competitionFormatId:x("format-b")})).toMatchObject({ok:false,error:{kind:"forbidden"}});});
 it("E,H cannot select another Person's membership or organization",async()=>{expect(await operations.execute({organizationId:x("org-outsider"),competitionFormatId:x("format-a")})).toMatchObject({ok:false,error:{kind:"forbidden"}});expect(JSON.stringify(await context.execute())).not.toContain(x("member-outsider"));});
});
