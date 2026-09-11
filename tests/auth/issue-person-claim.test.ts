import { describe, expect, it } from "vitest";
import { IssuePersonClaim } from "@app/use-cases/issue-person-claim";
import type { ClaimTokenGenerator, ClaimTokenHasher, RawClaimToken } from "@app/contracts";
import { InMemoryAccountRepository } from "@adapters/persistence/in-memory-account-repository";
import { InMemoryPersonClaimRepository } from "@adapters/persistence/in-memory-person-claim-repository";
import { InMemoryPersonRepository } from "@adapters/persistence/in-memory-person-repository";
import { FakeClock } from "@adapters/clock/fake-clock";
import { FakeIdGenerator } from "@adapters/id/fake-id-generator";
import type { AuthSubject } from "@domain/auth/account";
import type { AggregateVersion } from "@domain/aggregate";
import type { ClaimTokenHash } from "@domain/auth/person-claim";
import type { Person } from "@domain/identity/identity.types";
import type { Id, ISODateString } from "@shared/kernel";

const NOW="2026-09-11T00:00:00.000Z" as ISODateString; const PID="person-issue" as Id<"Person">; const RAW="one-time-secret" as RawClaimToken;
const hasher:ClaimTokenHasher={hash:t=>`secure:${t}` as ClaimTokenHash};
function person():Person{return{id:PID,version:1 as AggregateVersion,updatedAt:NOW,displayName:"Existing",dateOfBirth:null,lifecycleStatus:"active",sportsId:{value:"SID-I" as Id<"SportsId">,issuedAt:NOW,status:"active"}};}
async function setup(seed=true){const people=new InMemoryPersonRepository();if(seed)await people.create(person());const accounts=new InMemoryAccountRepository();const claims=new InMemoryPersonClaimRepository(accounts);let sequence=0;const generator:ClaimTokenGenerator={generate:()=>sequence++===0?RAW:`one-time-secret-${sequence}` as RawClaimToken};const useCase=new IssuePersonClaim({personRepository:people,accountRepository:accounts,personClaimRepository:claims,tokenGenerator:generator,tokenHasher:hasher,idGenerator:new FakeIdGenerator("issue"),clock:new FakeClock(NOW),lifetimeMs:3600000});return{useCase,accounts,claims};}
describe("IssuePersonClaim",()=>{
  it("issues for an existing unlinked Person and returns raw token once",async()=>{const{useCase}=await setup();const result=await useCase.execute({personId:PID});expect(result).toMatchObject({ok:true,value:{rawToken:RAW,claim:{personId:PID,status:"pending",expiresAt:"2026-09-11T01:00:00.000Z",version:1}}});if(result.ok){expect(result.value.claim.tokenHash).not.toBe(RAW);expect(result.value.claim).not.toHaveProperty("rawToken");}});
  it("rejects a missing Person",async()=>{const{useCase}=await setup(false);expect(await useCase.execute({personId:PID})).toMatchObject({ok:false,error:{kind:"person_not_found"}});});
  it("rejects a Person already linked",async()=>{const state=await setup();await state.accounts.create({id:"a" as Id<"Account">,authSubject:"s" as AuthSubject,personId:PID,status:"active",version:1 as AggregateVersion,createdAt:NOW,updatedAt:NOW});expect(await state.useCase.execute({personId:PID})).toMatchObject({ok:false,error:{kind:"person_already_linked"}});});
  it("revokes the prior pending claim when reissuing",async()=>{const state=await setup();const first=await state.useCase.execute({personId:PID});const second=await state.useCase.execute({personId:PID});expect(first.ok&&second.ok).toBe(true);if(first.ok)expect(await state.claims.findByTokenHash(first.value.claim.tokenHash)).toMatchObject({kind:"found",claim:{status:"revoked",version:2}});});
});
