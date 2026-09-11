import type { Id, ISODateString } from "@shared/kernel";

/**
 * Results & Achievements boundary (see
 * docs/architecture/results-achievements-model.md).
 *
 * Historical competition records are IMMUTABLE and append-only (invariant 5).
 * Achievements/championships are separate from spendable rewards (invariant 6).
 *
 * Ownership: historical/audit. Records are never deleted, even if the Person's
 * account is closed or the Person is anonymized. Results reference
 * AthleteProfile (not a tenant/organization).
 */
export type ResultStatus = "provisional" | "confirmed" | "amended" | "voided";

export interface CompetitionResult {
  readonly id: Id<"Result">;
  readonly tenantId: Id<"Tenant">;
  readonly competitionId: Id<"Competition">;
  readonly participantId: Id<"AthleteProfile"> | Id<"Team">;
  readonly participantKind: "individual" | "team";
  readonly status: ResultStatus;
  readonly recordedAt: ISODateString;
  readonly payload: ResultPayload;
}

export type ResultPayload =
  | { readonly kind: "timed"; readonly durationMs: number }
  | { readonly kind: "measured"; readonly value: number; readonly unit: string }
  | { readonly kind: "score"; readonly score: number }
  | { readonly kind: "placement"; readonly place: number }
  | { readonly kind: "judged"; readonly totalScore: number; readonly panelId: string };

export type AchievementKind =
  | "champion"
  | "runner_up"
  | "third_place"
  | "medalist"
  | "record_holder"
  | "participant_milestone";

export interface Achievement {
  readonly id: Id<"Achievement">;
  readonly athleteProfileId: Id<"AthleteProfile">;
  readonly sportId: Id<"Sport">;
  readonly kind: AchievementKind;
  readonly sourceResultId: Id<"Result">;
  readonly verifiedAt: ISODateString | null;
}
