import type { DomainEvent } from "@domain/aggregate";
import type { Id } from "@shared/kernel";

/**
 * Athlete-context domain events. Each represents a completed fact.
 *
 * Payloads carry only identifiers and issuance/participation facts. They MUST
 * NOT carry any Person identity data — no display name, no date of birth, no
 * Sports ID. `personId` appears on `AthleteProfileCreated` because "this Person
 * now has an athlete profile" is the fact itself; it is an opaque identifier
 * reference, not personal data.
 */
export interface AthleteProfileCreated extends DomainEvent {
  readonly type: "athlete.profile_created";
  readonly aggregateType: "AthleteProfile";
  readonly athleteProfileId: Id<"AthleteProfile">;
  readonly personId: Id<"Person">;
}

export interface AthleteSportAdded extends DomainEvent {
  readonly type: "athlete.sport_added";
  readonly aggregateType: "AthleteProfile";
  readonly athleteProfileId: Id<"AthleteProfile">;
  readonly participationId: Id<"AthleteSportParticipation">;
  readonly sportId: Id<"Sport">;
}

export type AthleteDomainEvent = AthleteProfileCreated | AthleteSportAdded;
