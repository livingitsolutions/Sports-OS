import type {
  AppError,
  AthleteProfileRepository,
  Clock,
  DomainEventPublisher,
  IdGenerator,
  SportDirectory,
  UseCase,
} from "@app/contracts";
import { addAthleteSport } from "@domain/athlete/athlete-sport";
import type { AthleteDomainEvent } from "@domain/athlete/athlete.events";
import type { AthleteSportParticipation } from "@domain/athlete/athlete.types";
import type { Id, Result } from "@shared/kernel";

export interface AddAthleteSportInput {
  readonly athleteProfileId: string;
  readonly sportId: string;
}

export interface AddAthleteSportOutput {
  readonly participation: AthleteSportParticipation;
  readonly events: readonly AthleteDomainEvent[];
}

export type AddAthleteSportErrorKind =
  | "invalid_input"
  | "athlete_profile_not_found"
  | "sport_not_found"
  | "already_participating"
  | "persistence_unavailable";

export interface AddAthleteSportError extends AppError {
  readonly kind: AddAthleteSportErrorKind;
}

export interface AddAthleteSportDeps {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly athleteProfileRepository: AthleteProfileRepository;
  readonly sportDirectory: SportDirectory;
  readonly domainEvents: DomainEventPublisher;
}

/**
 * AddAthleteSport — records that an athlete participates in a sport, supporting
 * many sports on the same AthleteProfile simultaneously.
 *
 * Flow: validate input -> confirm the AthleteProfile exists -> confirm the Sport
 * exists (via the SportDirectory query, not by importing the Sports domain) ->
 * confirm the athlete is not already actively participating in that sport ->
 * build a valid participation via the domain factory -> persist -> publish the
 * event ONLY after a durable write -> return a typed result.
 *
 * This records participation only; it is NOT competition entry, registration,
 * team membership, or any result/ranking/achievement history.
 */
export class AddAthleteSport
  implements UseCase<AddAthleteSportInput, AddAthleteSportOutput>
{
  constructor(private readonly deps: AddAthleteSportDeps) {}

  async execute(
    input: AddAthleteSportInput,
  ): Promise<Result<AddAthleteSportOutput, AddAthleteSportError>> {
    const athleteProfileId = input.athleteProfileId.trim() as Id<"AthleteProfile">;
    const sportId = input.sportId.trim() as Id<"Sport">;
    if (athleteProfileId.length === 0 || sportId.length === 0) {
      return failure(
        "invalid_input",
        "Both an athlete profile and a sport are required.",
      );
    }

    const profile =
      await this.deps.athleteProfileRepository.findById(athleteProfileId);
    if (profile === null) {
      return failure(
        "athlete_profile_not_found",
        "No athlete profile exists for this identifier.",
      );
    }

    const sportExists = await this.deps.sportDirectory.exists(sportId);
    if (!sportExists) {
      return failure("sport_not_found", "No sport exists for this identifier.");
    }

    const active = await this.deps.athleteProfileRepository.findActiveParticipation(
      athleteProfileId,
      sportId,
    );
    if (active !== null) {
      return failure(
        "already_participating",
        "This athlete already participates in this sport.",
      );
    }

    const now = this.deps.clock.now();
    const built = addAthleteSport({
      participationId: this.deps.idGenerator.next("AthleteSportParticipation"),
      athleteProfileId,
      sportId,
      now,
      addedEventId: this.deps.idGenerator.next("DomainEvent"),
    });
    if (!built.ok) {
      return failure("invalid_input", built.error.message);
    }

    const persisted = await this.deps.athleteProfileRepository.addParticipation(
      built.value.participation,
    );
    if (!persisted.ok) {
      switch (persisted.error.kind) {
        case "already_participating":
          return failure(
            "already_participating",
            "This athlete already participates in this sport.",
          );
        case "athlete_profile_not_found":
          return failure(
            "athlete_profile_not_found",
            "No athlete profile exists for this identifier.",
          );
        case "unavailable":
          return failure(
            "persistence_unavailable",
            persisted.error.detail ?? "Athlete storage is currently unavailable.",
          );
        default:
          return failure(
            "persistence_unavailable",
            "Athlete storage rejected the write.",
          );
      }
    }

    await this.deps.domainEvents.publishAll(built.value.events);

    return {
      ok: true,
      value: { participation: persisted.value, events: built.value.events },
    };
  }
}

function failure(
  kind: AddAthleteSportErrorKind,
  message: string,
): Result<never, AddAthleteSportError> {
  return { ok: false, error: { kind, code: kind, message } };
}
