import { INITIAL_AGGREGATE_VERSION, nextAggregateVersion } from "@domain/aggregate";
import type { AggregateVersion } from "@domain/aggregate";
import type { DomainError, Id, ISODateString, Result } from "@shared/kernel";

export type ClaimTokenHash = Id<"ClaimTokenHash">;
export type PersonClaimStatus = "pending" | "consumed" | "expired" | "revoked";

export interface PersonClaim {
  readonly id: Id<"PersonClaim">;
  readonly personId: Id<"Person">;
  readonly tokenHash: ClaimTokenHash;
  readonly status: PersonClaimStatus;
  readonly expiresAt: ISODateString;
  readonly consumedAt: ISODateString | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly version: AggregateVersion;
}

export function createPersonClaim(input: {
  readonly id: Id<"PersonClaim">;
  readonly personId: Id<"Person">;
  readonly tokenHash: ClaimTokenHash;
  readonly now: ISODateString;
  readonly expiresAt: ISODateString;
}): Result<PersonClaim, DomainError> {
  if (input.tokenHash.trim().length === 0) return fail("invalid_token_hash", "Claim token hash is required.");
  if (input.expiresAt <= input.now) return fail("invalid_expiration", "Claim expiration must be in the future.");
  return { ok: true, value: { id: input.id, personId: input.personId, tokenHash: input.tokenHash, status: "pending", expiresAt: input.expiresAt, consumedAt: null, createdAt: input.now, updatedAt: input.now, version: INITIAL_AGGREGATE_VERSION } };
}

export type ConsumeClaimError = DomainError & { readonly code: "expired_claim" | "consumed_claim" | "revoked_claim" };

export function consumePersonClaim(claim: PersonClaim, now: ISODateString): Result<PersonClaim, ConsumeClaimError> {
  if (claim.status === "consumed") return fail("consumed_claim", "Claim has already been consumed.");
  if (claim.status === "revoked") return fail("revoked_claim", "Claim has been revoked.");
  if (claim.status === "expired" || claim.expiresAt <= now) return fail("expired_claim", "Claim has expired.");
  return { ok: true, value: { ...claim, status: "consumed", consumedAt: now, updatedAt: now, version: nextAggregateVersion(claim.version) } };
}

export function revokePersonClaim(claim: PersonClaim, now: ISODateString): Result<PersonClaim, DomainError> {
  if (claim.status !== "pending") return fail("claim_not_pending", "Only a pending claim can be revoked.");
  return { ok: true, value: { ...claim, status: "revoked", updatedAt: now, version: nextAggregateVersion(claim.version) } };
}

function fail<C extends string>(code: C, message: string): Result<never, DomainError & { readonly code: C }> {
  return { ok: false, error: { code, message } };
}
