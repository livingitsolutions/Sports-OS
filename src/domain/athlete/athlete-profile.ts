import type { DomainError, Id, ISODateString } from "@shared/kernel";
import { Result } from "@shared/kernel";
import type { AthleteProfile } from "@domain/athlete/athlete.types";
import type {
  AthleteDomainEvent,
  AthleteProfileCreated,
} from "@domain/athlete/athlete.events";

/**
 * Everything `createAthleteProfile` needs, supplied as plain values. The domain
 * never generates identifiers or reads a clock (ADR-016): the application
 * generates the AthleteProfile ID and the event ID and reads the timestamp,
 * then hands them in.
 */
export interface NewAthleteProfileInput {
  readonly athleteProfileId: Id<"AthleteProfile">;
  readonly personId: Id<"Person">;
  readonly now: ISODateString;
  readonly createdEventId: string;
}

export interface CreatedAthleteProfile {
  readonly profile: AthleteProfile;
  readonly events: readonly AthleteDomainEvent[];
}

/**
 * Creates a valid, active AthleteProfile for an existing Person.
 *
 * Enforced invariants:
 *  - the profile references exactly one Person (non-empty `personId`);
 *  - the initial lifecycle status is "active";
 *  - it holds NO Person identity data (name, date of birth, Sports ID).
 *
 * "A Person has at most one AthleteProfile" and "the Person exists" are
 * cross-aggregate rules enforced by the application/repository, not here.
 *
 * Expected validation failures are returned as a typed `Result`, never thrown.
 */
export function createAthleteProfile(
  input: NewAthleteProfileInput,
): Result<CreatedAthleteProfile, DomainError> {
  if (input.personId.trim().length === 0) {
    return Result.fail(err("invalid_person", "A Person reference is required."));
  }

  const profile: AthleteProfile = {
    id: input.athleteProfileId,
    personId: input.personId,
    status: "active",
    createdAt: input.now,
  };

  const created: AthleteProfileCreated = {
    type: "athlete.profile_created",
    eventId: input.createdEventId,
    occurredAt: input.now,
    aggregateId: input.athleteProfileId,
    aggregateType: "AthleteProfile",
    athleteProfileId: input.athleteProfileId,
    personId: input.personId,
  };

  return Result.ok({ profile, events: [created] });
}

function err(code: string, message: string): DomainError {
  return { code, message };
}
