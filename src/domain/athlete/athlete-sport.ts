import type { DomainError, Id, ISODateString } from "@shared/kernel";
import { Result } from "@shared/kernel";
import type { AthleteSportParticipation } from "@domain/athlete/athlete.types";
import type {
  AthleteDomainEvent,
  AthleteSportAdded,
} from "@domain/athlete/athlete.events";

/**
 * Everything `addAthleteSport` needs, supplied as plain values. The application
 * generates the participation ID and event ID and reads the clock.
 */
export interface NewParticipationInput {
  readonly participationId: Id<"AthleteSportParticipation">;
  readonly athleteProfileId: Id<"AthleteProfile">;
  readonly sportId: Id<"Sport">;
  readonly now: ISODateString;
  readonly addedEventId: string;
}

export interface AddedAthleteSport {
  readonly participation: AthleteSportParticipation;
  readonly events: readonly AthleteDomainEvent[];
}

/**
 * Builds a valid, active participation linking an AthleteProfile to a Sport.
 *
 * Enforced invariants:
 *  - the participation references a Sport (non-empty `sportId`) and a profile;
 *  - it starts "active" with `startedAt = now` and no end date;
 *  - it copies NO Sport data — the Sport is referenced by identifier only.
 *
 * "The AthleteProfile exists", "the Sport exists", and "the athlete is not
 * already actively participating in this sport" are cross-aggregate rules
 * enforced by the application/repository, not here.
 */
export function addAthleteSport(
  input: NewParticipationInput,
): Result<AddedAthleteSport, DomainError> {
  if (input.sportId.trim().length === 0) {
    return Result.fail(err("invalid_sport", "A Sport reference is required."));
  }
  if (input.athleteProfileId.trim().length === 0) {
    return Result.fail(
      err("invalid_athlete_profile", "An AthleteProfile reference is required."),
    );
  }

  const participation: AthleteSportParticipation = {
    id: input.participationId,
    athleteProfileId: input.athleteProfileId,
    sportId: input.sportId,
    status: "active",
    startedAt: input.now,
    endedAt: null,
  };

  const added: AthleteSportAdded = {
    type: "athlete.sport_added",
    eventId: input.addedEventId,
    occurredAt: input.now,
    aggregateId: input.athleteProfileId,
    aggregateType: "AthleteProfile",
    athleteProfileId: input.athleteProfileId,
    participationId: input.participationId,
    sportId: input.sportId,
  };

  return Result.ok({ participation, events: [added] });
}

function err(code: string, message: string): DomainError {
  return { code, message };
}
