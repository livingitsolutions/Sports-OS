import type {
  AppError,
  Clock,
  DomainEventPublisher,
  IdGenerator,
  PersonRepository,
  SportsIdGenerator,
  UseCase,
} from "@app/contracts";
import { createPerson } from "@domain/identity/person";
import type { IdentityDomainEvent } from "@domain/identity/identity.events";
import type { Person, SportsId } from "@domain/identity/identity.types";
import type { Id, Result } from "@shared/kernel";

export interface CreatePersonInput {
  readonly displayName: string;
  readonly dateOfBirth?: string | null;
}

export interface CreatePersonOutput {
  readonly person: Person;
  readonly sportsId: SportsId;
  readonly events: readonly IdentityDomainEvent[];
}

export type CreatePersonErrorKind =
  | "invalid_input"
  | "sports_id_collision"
  | "duplicate_person_id"
  | "persistence_unavailable";

/** Typed, expected failure. Conforms to AppError so it satisfies UseCase. */
export interface CreatePersonError extends AppError {
  readonly kind: CreatePersonErrorKind;
}

export interface CreatePersonDeps {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly sportsIdGenerator: SportsIdGenerator;
  readonly personRepository: PersonRepository;
  readonly domainEvents: DomainEventPublisher;
  /** Bounded number of Sports ID candidates to try before giving up. */
  readonly maxSportsIdAttempts?: number;
}

/**
 * CreatePerson — the first real business vertical slice.
 *
 * Flow: normalize input -> generate a Person ID -> obtain a globally-unique
 * Sports ID (bounded retry against the repository) -> read the clock -> build a
 * valid Person via the domain factory (which issues the Sports ID and produces
 * the domain events) -> persist -> publish events ONLY after a durable create
 * -> return a typed result.
 *
 * Events are never published for a failed create. Real transactional
 * guarantees (e.g. an outbox so persistence and publication cannot diverge) are
 * a future concern and are intentionally NOT implemented here.
 */
export class CreatePerson
  implements UseCase<CreatePersonInput, CreatePersonOutput>
{
  private readonly maxSportsIdAttempts: number;

  constructor(private readonly deps: CreatePersonDeps) {
    this.maxSportsIdAttempts = deps.maxSportsIdAttempts ?? 5;
  }

  async execute(
    input: CreatePersonInput,
  ): Promise<Result<CreatePersonOutput, CreatePersonError>> {
    if (input.displayName.trim().length === 0) {
      return failure("invalid_input", "Display name is required.");
    }

    const personId = this.deps.idGenerator.next("Person");

    const sportsIdValue = await this.reserveUniqueSportsId();
    if (sportsIdValue === null) {
      return failure(
        "sports_id_collision",
        `Could not obtain a unique Sports ID after ${this.maxSportsIdAttempts} attempts.`,
      );
    }

    const now = this.deps.clock.now();
    const created = createPerson({
      personId,
      sportsIdValue,
      displayName: input.displayName,
      dateOfBirth: input.dateOfBirth ?? null,
      now,
      personCreatedEventId: this.deps.idGenerator.next("DomainEvent"),
      sportsIdIssuedEventId: this.deps.idGenerator.next("DomainEvent"),
    });
    if (!created.ok) {
      return failure("invalid_input", created.error.message);
    }

    const persisted = await this.deps.personRepository.create(created.value.person);
    if (!persisted.ok) {
      switch (persisted.error.kind) {
        case "duplicate_person_id":
          return failure("duplicate_person_id", "A person with this identifier already exists.");
        case "duplicate_sports_id":
          return failure("sports_id_collision", "The issued Sports ID is already in use.");
        case "unavailable":
          return failure(
            "persistence_unavailable",
            persisted.error.detail ?? "Person storage is currently unavailable.",
          );
      }
    }

    await this.deps.domainEvents.publishAll(created.value.events);

    return {
      ok: true,
      value: {
        person: persisted.value,
        sportsId: created.value.sportsId,
        events: created.value.events,
      },
    };
  }

  private async reserveUniqueSportsId(): Promise<Id<"SportsId"> | null> {
    for (let attempt = 0; attempt < this.maxSportsIdAttempts; attempt += 1) {
      const candidate = this.deps.sportsIdGenerator.next();
      const existing = await this.deps.personRepository.findBySportsId(candidate);
      if (existing === null) return candidate;
    }
    return null;
  }
}

function failure(
  kind: CreatePersonErrorKind,
  message: string,
): Result<never, CreatePersonError> {
  return { ok: false, error: { kind, code: kind, message } };
}
