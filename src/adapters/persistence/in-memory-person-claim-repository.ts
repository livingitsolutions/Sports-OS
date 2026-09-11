import type { AccountRepository, ClaimAccountLinkError, ClaimAccountLinkRepository, PersonClaimLookupResult, PersonClaimPersistenceError, PersonClaimRepository } from "@app/contracts";
import type { Account } from "@domain/auth/account";
import type { AggregateVersion } from "@domain/aggregate";
import type { ClaimTokenHash, PersonClaim } from "@domain/auth/person-claim";
import type { Result } from "@shared/kernel";

export class InMemoryPersonClaimRepository implements PersonClaimRepository, ClaimAccountLinkRepository {
  private readonly claims = new Map<string, PersonClaim>();
  failIssues = false;
  failLinks = false;
  constructor(private readonly accounts: AccountRepository) {}

  async issueReplacingPending(claim: PersonClaim, replacement?: { readonly revokedClaim: PersonClaim; readonly expectedVersion: AggregateVersion }): Promise<Result<PersonClaim, PersonClaimPersistenceError>> {
    if (this.failIssues) return { ok: false, error: { kind: "unavailable" } };
    if (claim.version !== 1 || claim.status !== "pending") return { ok: false, error: { kind: "invalid_persistence_state" } };
    if ([...this.claims.values()].some((value) => value.tokenHash === claim.tokenHash)) return { ok: false, error: { kind: "duplicate_token_hash" } };
    const pending = [...this.claims.values()].find((value) => value.personId === claim.personId && value.status === "pending");
    if (pending !== undefined && (replacement === undefined || replacement.revokedClaim.id !== pending.id || replacement.expectedVersion !== pending.version)) return { ok: false, error: { kind: "concurrency_conflict" } };
    if (replacement !== undefined) this.claims.set(replacement.revokedClaim.id, replacement.revokedClaim);
    this.claims.set(claim.id, claim);
    return { ok: true, value: claim };
  }
  async findByTokenHash(tokenHash: ClaimTokenHash): Promise<PersonClaimLookupResult> {
    const claim = [...this.claims.values()].find((value) => value.tokenHash === tokenHash);
    return claim === undefined ? { kind: "not_found" } : { kind: "found", claim };
  }
  async findPendingByPersonId(personId: import("@shared/kernel").Id<"Person">): Promise<PersonClaimLookupResult> {
    const claim = [...this.claims.values()].find((value) => value.personId === personId && value.status === "pending");
    return claim === undefined ? { kind: "not_found" } : { kind: "found", claim };
  }
  async createAccountAndConsumeClaim(account: Account, consumedClaim: PersonClaim, expectedClaimVersion: AggregateVersion): Promise<Result<Account, ClaimAccountLinkError>> {
    if (this.failLinks) return { ok: false, error: { kind: "unavailable" } };
    const current = this.claims.get(consumedClaim.id);
    if (current === undefined) return { ok: false, error: { kind: "claim_not_found" } };
    if (current.status === "consumed") return { ok: false, error: { kind: "consumed_claim" } };
    if (current.status === "revoked") return { ok: false, error: { kind: "revoked_claim" } };
    if (current.version !== expectedClaimVersion) return { ok: false, error: { kind: "concurrency_conflict" } };
    if (current.expiresAt <= consumedClaim.updatedAt) return { ok: false, error: { kind: "expired_claim" } };
    const created = await this.accounts.create(account);
    if (!created.ok) return { ok: false, error: { kind: created.error.kind === "auth_subject_already_linked" || created.error.kind === "person_already_linked" || created.error.kind === "person_not_found" ? created.error.kind : "unavailable" } };
    this.claims.set(consumedClaim.id, consumedClaim);
    return { ok: true, value: created.value };
  }
}
