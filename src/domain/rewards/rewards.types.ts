import type { Id, ISODateString } from "@shared/kernel";

/**
 * Rewards accounting boundary (see ADR-006, ADR-015,
 * docs/architecture/rewards-model.md).
 *
 * Source of truth is an append-only ledger. A balance is a DERIVED projection
 * of the ledger, never authoritative. Extended with idempotent issuance,
 * source identity, earning rule identity/version, duplicate-award prevention,
 * reversal, adjustment, redemption, and expiration entries.
 */

export type LedgerEntryKind =
  | "issuance"
  | "reversal"
  | "adjustment"
  | "redemption"
  | "expiry";

export interface RewardsLedgerEntry {
  readonly id: Id<"RewardsLedgerEntry">;
  readonly tenantId: Id<"Tenant">;
  readonly athleteProfileId: Id<"AthleteProfile">;
  readonly kind: LedgerEntryKind;
  readonly points: number;
  readonly sourceResultId: Id<"Result"> | null;
  readonly sourceIdentity: RewardSourceIdentity | null;
  readonly earningRuleId: string | null;
  readonly earningRuleVersion: number | null;
  readonly idempotencyKey: string | null;
  readonly verified: boolean;
  readonly verificationRef: string | null;
  readonly reversesEntryId: Id<"RewardsLedgerEntry"> | null;
  readonly recordedAt: ISODateString;
}

/**
 * Identifies what triggered an issuance so duplicate-award prevention can
 * detect the same source producing two issuances.
 */
export interface RewardSourceIdentity {
  readonly sourceType: "result" | "achievement" | "event_participation" | "manual";
  readonly sourceId: string;
}

/**
 * Derived balance — recomputed from the ledger, not authoritative.
 */
export interface RewardsBalance {
  readonly athleteProfileId: Id<"AthleteProfile">;
  readonly tenantId: Id<"Tenant">;
  readonly available: number;
  readonly pending: number;
  readonly asOfLedgerEntryId: string;
}
