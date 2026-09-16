import {createClient} from "@supabase/supabase-js";
import {SupabaseAuthIdentityProvider} from "@adapters/auth/supabase-auth-identity-provider";
import {createSql,readPgConfigFromEnv} from "@adapters/persistence/pg/connection";
import {PgAccountRepository} from "@adapters/persistence/pg/pg-account-repository";
import {PgPersonRepository} from "@adapters/persistence/pg/pg-person-repository";
import {PgOrganizationRepository} from "@adapters/persistence/pg/pg-organization-repository";
import {PgOrganizationMembershipRepository} from "@adapters/persistence/pg/pg-organization-membership-repository";
import {PgOrganizationRoleAssignmentRepository,PgOrganizationRoleRepository} from "@adapters/persistence/pg/pg-organization-authorization-repositories";
import {PgTournamentOperationsReader} from "@adapters/persistence/pg/pg-tournament-operations-reader";
import {AuthorizeOrganizationPermission} from "@app/use-cases/authorize-organization-permission";
import {GetTournamentOperationsView} from "@app/use-cases/get-tournament-operations-view";
import {GetOrganizerContext} from "@app/use-cases/get-organizer-context";
import {GetAuthenticatedTournamentOperationsView} from "@app/use-cases/get-authenticated-tournament-operations-view";
export interface OrganizerRequestRuntime {readonly organizerContext:GetOrganizerContext;readonly tournamentOperations:GetAuthenticatedTournamentOperationsView;close():Promise<void>;}
export function createOrganizerRequestRuntime(env:Record<string,string|undefined>,authorizationHeader:string):OrganizerRequestRuntime{
 const url=env.SUPABASE_URL,publicKey=env.SUPABASE_ANON_KEY;if(!url?.trim()||!publicKey?.trim())throw new Error("Required Supabase server authentication configuration is missing.");
 const client=createClient(url,publicKey,{global:{headers:{Authorization:authorizationHeader}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),sql=createSql(readPgConfigFromEnv(env));
 const authIdentityProvider=new SupabaseAuthIdentityProvider(client),accountRepository=new PgAccountRepository(sql),personRepository=new PgPersonRepository(sql),membershipRepository=new PgOrganizationMembershipRepository(sql),organizationRepository=new PgOrganizationRepository(sql);
 const organizerContext=new GetOrganizerContext({authIdentityProvider,accountRepository,personRepository,membershipRepository,organizationRepository});
 const authorization=new AuthorizeOrganizationPermission({membershipRepository,roleRepository:new PgOrganizationRoleRepository(sql),assignmentRepository:new PgOrganizationRoleAssignmentRepository(sql)}),base=new GetTournamentOperationsView({reader:new PgTournamentOperationsReader(sql),authorization});
 return {organizerContext,tournamentOperations:new GetAuthenticatedTournamentOperationsView({organizerContext,tournamentOperations:base}),close:()=>sql.end({timeout:5})};
}
