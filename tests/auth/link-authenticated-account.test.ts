import { describe, expect, it } from "vitest";
import { LinkAuthenticatedAccountToExistingPerson } from "@app/use-cases/link-authenticated-account-to-existing-person";
import type { AuthIdentityProvider, ClaimTokenHasher, RawClaimToken } from "@app/contracts";
import { InMemoryAccountRepository } from "@adapters/persistence/in-memory-account-repository";
import { InMemoryPersonClaimRepository } from "@adapters/persistence/in-memory-person-claim-repository";
import { InMemoryPersonRepository } from "@adapters/persistence/in-memory-person-repository";
import { FakeClock } from "@adapters/clock/fake-clock";
import { FakeIdGenerator } from "@adapters/id/fake-id-generator";
import { createPersonClaim, revokePersonClaim } from "@domain/auth/person-claim";
import type { AuthSubject } from "@domain/auth/account";
import type { Person } from "@domain/identity/identity.types";
import type { AggregateVersion } from "@domain/aggregate";
import type { ClaimTokenHash } from "@domain/auth/person-claim";
import type { Id, ISODateString } from "@shared/kernel";

const NOW = "2026-09-11T00:00:00.000Z" as ISODateString;
const PERSON = "person-claim-owner" as Id<"Person">;
const TOKEN = "raw-token" as RawClaimToken;
const hasher: ClaimTokenHasher = { hash: (token) => `hash:${token}` as ClaimTokenHash };
const auth = (subject = "subject-1"): AuthIdentityProvider => ({ getCurrentIdentity: async () => ({ kind: "authenticated", identity: { subject: subject as AuthSubject } }) });
function person(id = PERSON): Person { return { id, version: 1 as AggregateVersion, updatedAt: NOW, displayName: "Claim Owner", dateOfBirth: null, lifecycleStatus: "active", sportsId: { value: `SID-${id}` as Id<"SportsId">, issuedAt: NOW, status: "active" } }; }

async function setup(options: { expiresAt?: string; provider?: AuthIdentityProvider } = {}) {
  const people = new InMemoryPersonRepository(); await people.create(person());
  const accounts = new InMemoryAccountRepository();
  const claims = new InMemoryPersonClaimRepository(accounts);
  const made = createPersonClaim({ id: "claim-1" as Id<"PersonClaim">, personId: PERSON, tokenHash: hasher.hash(TOKEN), now: NOW, expiresAt: (options.expiresAt ?? "2026-09-12T00:00:00.000Z") as ISODateString });
  if (!made.ok) throw new Error(made.error.message); await claims.issueReplacingPending(made.value);
  const clock = new FakeClock(NOW);
  const useCase = new LinkAuthenticatedAccountToExistingPerson({ authIdentityProvider: options.provider ?? auth(), tokenHasher: hasher, personClaimRepository: claims, claimAccountLinkRepository: claims, accountRepository: accounts, personRepository: people, idGenerator: new FakeIdGenerator("link"), clock });
  return { useCase, claims, accounts, claim: made.value, clock };
}

describe("claim-authorized Account linkage", () => {
  it("links using the Person derived from a valid claim", async () => { const { useCase }=await setup(); const result=await useCase.execute({rawClaimToken:TOKEN}); expect(result).toMatchObject({ok:true,value:{account:{personId:PERSON}}}); });
  it("cannot use a supplied arbitrary Person ID", async () => { const { useCase }=await setup(); const result=await useCase.execute({rawClaimToken:TOKEN,personId:"attacker-choice"} as never); expect(result).toMatchObject({ok:true,value:{account:{personId:PERSON}}}); });
  it("rejects an invalid token", async () => { const {useCase}=await setup(); expect(await useCase.execute({rawClaimToken:"wrong" as RawClaimToken})).toMatchObject({ok:false,error:{kind:"invalid_claim"}}); });
  it("rejects an expired claim", async () => { const state=await setup({expiresAt:"2026-09-11T00:00:01.000Z"}); state.clock.advance(1001); expect(await state.useCase.execute({rawClaimToken:TOKEN})).toMatchObject({ok:false,error:{kind:"expired_claim"}}); });
  it("rejects a revoked claim", async () => { const state=await setup(); const revoked=revokePersonClaim(state.claim,NOW); if(!revoked.ok) throw new Error(); await state.claims.issueReplacingPending({...state.claim,id:"claim-2" as Id<"PersonClaim">,tokenHash:"hash:new" as ClaimTokenHash}, {revokedClaim:revoked.value,expectedVersion:state.claim.version}); expect(await state.useCase.execute({rawClaimToken:TOKEN})).toMatchObject({ok:false,error:{kind:"revoked_claim"}}); });
  it("requires authentication", async () => { const {useCase}=await setup({provider:{getCurrentIdentity:async()=>({kind:"unauthenticated"})}}); expect(await useCase.execute({rawClaimToken:TOKEN})).toMatchObject({ok:false,error:{kind:"authenticated_subject_required"}}); });
  it("rejects an auth subject already linked", async () => { const state=await setup(); await state.accounts.create({id:"existing" as Id<"Account">,authSubject:"subject-1" as AuthSubject,personId:"other" as Id<"Person">,status:"active",version:1 as AggregateVersion,createdAt:NOW,updatedAt:NOW}); expect(await state.useCase.execute({rawClaimToken:TOKEN})).toMatchObject({ok:false,error:{kind:"auth_subject_already_linked"}}); });
  it("rejects a Person already linked", async () => { const state=await setup(); await state.accounts.create({id:"existing" as Id<"Account">,authSubject:"other" as AuthSubject,personId:PERSON,status:"active",version:1 as AggregateVersion,createdAt:NOW,updatedAt:NOW}); expect(await state.useCase.execute({rawClaimToken:TOKEN})).toMatchObject({ok:false,error:{kind:"person_already_linked"}}); });
  it("does not consume after atomic persistence failure", async () => { const state=await setup(); state.claims.failLinks=true; expect((await state.useCase.execute({rawClaimToken:TOKEN})).ok).toBe(false); expect(await state.claims.findByTokenHash(hasher.hash(TOKEN))).toMatchObject({kind:"found",claim:{status:"pending",version:1}}); });
  it("does not consume when Account creation fails", async () => { const state=await setup(); state.accounts.failCreates=true; expect((await state.useCase.execute({rawClaimToken:TOKEN})).ok).toBe(false); expect(await state.claims.findByTokenHash(hasher.hash(TOKEN))).toMatchObject({kind:"found",claim:{status:"pending"}}); });
  it("consumes only on success and rejects replay", async () => { const state=await setup(); expect((await state.useCase.execute({rawClaimToken:TOKEN})).ok).toBe(true); expect(await state.claims.findByTokenHash(hasher.hash(TOKEN))).toMatchObject({kind:"found",claim:{status:"consumed",version:2}}); expect(await state.useCase.execute({rawClaimToken:TOKEN})).toMatchObject({ok:false,error:{kind:"consumed_claim"}}); });
  it("allows only one of two attempts", async () => { const state=await setup(); const [a,b]=await Promise.all([state.useCase.execute({rawClaimToken:TOKEN}),state.useCase.execute({rawClaimToken:TOKEN})]); expect([a,b].filter(x=>x.ok)).toHaveLength(1); });
});
