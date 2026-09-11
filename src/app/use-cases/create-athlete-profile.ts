import type {
  AppError,
  AthleteProfileRepository,
  Clock,
  DomainEventPublisher,
  IdGenerator,
  PersonRepository,
  UseCase,
} from "@app/contracts";
import { createAthleteProfile } from "@domain/athlete/athlete-profile";
import type { AthleteDomainEvent } from "@domain/athlete/athlete.events";
import type { AthleteProfile } from "@domain/athlete/athlete.types";
import type { Id, Result } from "@shared/kernel";

export interface CreateAthleteProfileInput {
  /** The existing Person who is becoming an athlete. */
  readonly personId: string;
}

export interface CreateAthleteProfileOutput {
  readonly profile: AthleteProfile;
  readonly events: readonly AthleteDomainEvent[];
}

export type CreateAthleteProfileErrorKind =
  | "invalid_input"
  | "person_not_found"
  | "athlete_profile_already_exists"
  | "duplicate_athlete_profile_id"
  | "persistence_unavailable";

export interface CreateAthleteProfileError extends AppError {
  readonly kind: CreateAthleteProfileErrorKind;
}

export interface CreateAthleteProfileDeps {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly personRepository: PersonRepository;
  readonly athleteProfileRepository: AthleteProfileRepository;
  readonly domainEvents: DomainEventPublisher;
}

/**
 * CreateAthleteProfile — turns an existing Person into an athlete by creating
 * their single, optional AthleteProfile.
 *
 * Flow: validate input -> confirm the Person exists -> confirm the Person does
 * not already have an AthleteProfile -> generate an AthleteProfile ID -> build a
 * valid profile via the domain factory -> persist -> publish events ONLY after a
 * durable create -> return a typed result.
 *
 * Events are never published for a failed create. Real transactional guarantees
 * (an outbox so persistence and publication cannot diverge) are a future concern
 * and are intentionally NOT implemented here.
 */
export class CreateAthleteProfile
  implements UseCase<CreateAthleteProfileInput, CreateAthleteProfileOutput>
{
  constructor(private readonly deps: CreateAthleteProfileDeps) {}

  async execute(
    input: CreateAthleteProfileInput,
  ): Promise<Result<CreateAthleteProfileOutput, CreateAthleteProfileError>> {
    const personId = input.personId.trim() as Id<"Person">;
    if (personId.length === 0) {
      return failure("invalid_input", "A Person reference is required.");
    }

    const person = await this.deps.personRepository.findById(personId);
    if (person === null) {
      return failure("person_not_found", "No Person exists for this identifier.");
    }

    const existing =
      await this.deps.athleteProfileRepository.findByPersonId(personId);
    if (existing !== null) {
      return failure(
        "athlete_profile_already_exists",
        "This Person already has an athlete profile.",
      );
    }

    const now = this.deps.clock.now();
    const created = createAthleteProfile({
      athleteProfileId: this.deps.idGenerator.next("AthleteProfile"),
      personId,
      now,
      createdEventId: this.deps.idGenerator.next("DomainEvent"),
    });
    if (!created.ok) {
      return failure("invalid_input", created.error.message);
    }

    const persisted = await this.deps.athleteProfileRepository.create(
      created.value.profile,
    );
    if (!persisted.ok) {
      switch (persisted.error.kind) {
        case "duplicate_athlete_profile_id":
          return failure(
            "duplicate_athlete_profile_id",
            "An athlete profile with this identifier already exists.",
          );
        case "person_already_has_profile":
          return failure(
            "athlete_profile_already_exists",
            "This Person already has an athlete profile.",
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

    await this.deps.domainEvents.publishAll(created.value.events);

    return {
      ok: true,
      value: { profile: persisted.value, events: created.value.events },
    };
  }
}

function failure(
  kind: CreateAthleteProfileErrorKind,
  message: string,
): Result<never, CreateAthleteProfileError> {
  return { ok: false, error: { kind, code: kind, message } };
}
