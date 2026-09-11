import { NodeClaimTokenGenerator, VersionedHmacClaimHashKeyProvider, readClaimHashKeyConfig } from "@adapters/auth/node-claim-token-crypto";
import { SystemClock } from "@adapters/clock/system-clock";
import { UuidIdGenerator } from "@adapters/id/uuid-id-generator";
import { createSql, readPgConfigFromEnv } from "@adapters/persistence/pg/connection";
import { PgAccountRepository } from "@adapters/persistence/pg/pg-account-repository";
import { PgPersonClaimRepository } from "@adapters/persistence/pg/pg-person-claim-repository";
import { PgPersonRepository } from "@adapters/persistence/pg/pg-person-repository";
import type { ClaimIssuancePrincipalProvider, TrustedClaimIssuer } from "@app/contracts";
import { IssuePersonClaim } from "@app/use-cases/issue-person-claim";
import type { ClaimIssuerType } from "@domain/auth/person-claim";

/** Internal composition only. No HTTP/function route exposes this runtime. */
export function createTrustedClaimIssuanceRuntime(env: Record<string,string|undefined>, identity: { readonly type:ClaimIssuerType; readonly subject:string }) {
  if (!(["system","admin","onboarding"] as string[]).includes(identity.type)||identity.subject.trim().length===0||identity.subject.length>200) throw new Error("Trusted claim issuer configuration is invalid.");
  const issuer={...identity} as TrustedClaimIssuer;
  const issuerProvider:ClaimIssuancePrincipalProvider={current:()=>({kind:"trusted",issuer})};
  const hashKeys=new VersionedHmacClaimHashKeyProvider(readClaimHashKeyConfig(env));
  const tokenGenerator=new NodeClaimTokenGenerator(),sql=createSql(readPgConfigFromEnv(env));
  const personRepository=new PgPersonRepository(sql),accountRepository=new PgAccountRepository(sql),personClaimRepository=new PgPersonClaimRepository(sql);
  return { tokenGenerator,hashKeys,personRepository,accountRepository,personClaimRepository,issuePersonClaim:new IssuePersonClaim({personRepository,accountRepository,personClaimRepository,tokenGenerator,hashKeys,issuerProvider,idGenerator:new UuidIdGenerator(),clock:new SystemClock()}) };
}
