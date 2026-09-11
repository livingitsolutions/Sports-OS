import type { Account } from "@domain/auth/account";
import type { AggregateVersion } from "@domain/aggregate";
import type { ClaimTokenHash, PersonClaim } from "@domain/auth/person-claim";
import type { Result } from "@shared/kernel";

export type PersonClaimPersistenceError =
  | { readonly kind: "duplicate_claim_id" | "duplicate_token_hash" | "person_not_found" | "person_already_linked" | "concurrency_conflict" }
  | { readonly kind: "invalid_persistence_state"; readonly detail?: string }
  | { readonly kind: "unavailable"; readonly detail?: string };
export type PersonClaimLookupResult =
  | { readonly kind: "found"; readonly claim: PersonClaim }
  | { readonly kind: "not_found" }
  | { readonly kind: "invalid_persistence_state" | "unavailable"; readonly detail?: string };

export interface PersonClaimRepository {
  /** Atomically revokes any pending claim for the Person and creates this claim. */
  issueReplacingPending(claim: PersonClaim, replacement?: { readonly revokedClaim: PersonClaim; readonly expectedVersion: AggregateVersion }): Promise<Result<PersonClaim, PersonClaimPersistenceError>>;
  findByTokenHash(tokenHash: ClaimTokenHash): Promise<PersonClaimLookupResult>;
  findPendingByPersonId(personId: import("@shared/kernel").Id<"Person">): Promise<PersonClaimLookupResult>;
}

export type ClaimAccountLinkError =
  | { readonly kind: "claim_not_found" | "expired_claim" | "consumed_claim" | "revoked_claim" | "concurrency_conflict" }
  | { readonly kind: "auth_subject_already_linked" | "person_already_linked" | "person_not_found" }
  | { readonly kind: "invalid_persistence_state" | "unavailable"; readonly detail?: string };

/** Narrow atomic write boundary: no database transaction type crosses into Application. */
export interface ClaimAccountLinkRepository {
  createAccountAndConsumeClaim(account: Account, consumedClaim: PersonClaim, expectedClaimVersion: AggregateVersion): Promise<Result<Account, ClaimAccountLinkError>>;
}
