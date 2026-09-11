import { createClient } from "@supabase/supabase-js";
import { SupabaseAuthIdentityProvider } from "@adapters/auth/supabase-auth-identity-provider";
import { NodeClaimTokenGenerator, VersionedHmacClaimHashKeyProvider, readClaimHashKeyConfig } from "@adapters/auth/node-claim-token-crypto";
import { SystemClock } from "@adapters/clock/system-clock";
import { UuidIdGenerator } from "@adapters/id/uuid-id-generator";
import { createSql, readPgConfigFromEnv } from "@adapters/persistence/pg/connection";
import { PgAccountRepository } from "@adapters/persistence/pg/pg-account-repository";
import { PgPersonClaimRepository } from "@adapters/persistence/pg/pg-person-claim-repository";
import { PgPersonRepository } from "@adapters/persistence/pg/pg-person-repository";
import { LinkAuthenticatedAccountToExistingPerson } from "@app/use-cases/link-authenticated-account-to-existing-person";

export interface AccountLinkRequestRuntime {
  readonly linkPerson: LinkAuthenticatedAccountToExistingPerson;
  close(): Promise<void>;
}

/** Builds an isolated caller-authenticated context for one HTTP request. */
export function createAccountLinkRequestRuntime(env: Record<string,string|undefined>, authorization: string): AccountLinkRequestRuntime {
  const url=env.SUPABASE_URL,publicKey=env.SUPABASE_ANON_KEY;
  if (url===undefined||publicKey===undefined||url.trim()===""||publicKey.trim()==="") throw new Error("Required Supabase server authentication configuration is missing.");
  const client=createClient(url,publicKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const authIdentityProvider=new SupabaseAuthIdentityProvider(client);
  const hashKeys=new VersionedHmacClaimHashKeyProvider(readClaimHashKeyConfig(env));
  const sql=createSql(readPgConfigFromEnv(env));
  const personRepository=new PgPersonRepository(sql),accountRepository=new PgAccountRepository(sql),personClaimRepository=new PgPersonClaimRepository(sql);
  return {linkPerson:new LinkAuthenticatedAccountToExistingPerson({authIdentityProvider,tokenGenerator:new NodeClaimTokenGenerator(),hashKeys,personClaimRepository,claimAccountLinkRepository:personClaimRepository,accountRepository,personRepository,idGenerator:new UuidIdGenerator(),clock:new SystemClock()}),close:async()=>sql.end({timeout:5})};
}
