import type { AppError, Clock, DomainEventPublisher, IdGenerator, PersonRepository, UseCase } from "@app/contracts";
import { deactivatePerson } from "@domain/identity/person";
import type { PersonDeactivated } from "@domain/identity/identity.events";
import type { Person } from "@domain/identity/identity.types";
import type { Id, Result } from "@shared/kernel";

export interface DeactivatePersonInput { readonly personId: string; }
export interface DeactivatePersonOutput { readonly person: Person; readonly event: PersonDeactivated; }
export type DeactivatePersonErrorKind = "invalid_input" | "person_not_found" | "invalid_transition" | "concurrency_conflict" | "persistence_unavailable" | "invalid_persistence_state";
export interface DeactivatePersonError extends AppError { readonly kind: DeactivatePersonErrorKind; }
export interface DeactivatePersonDeps {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly personRepository: PersonRepository;
  readonly domainEvents: DomainEventPublisher;
}

export class DeactivatePerson implements UseCase<DeactivatePersonInput, DeactivatePersonOutput> {
  constructor(private readonly deps: DeactivatePersonDeps) {}

  async execute(input: DeactivatePersonInput): Promise<Result<DeactivatePersonOutput, DeactivatePersonError>> {
    const personId = input.personId.trim() as Id<"Person">;
    if (personId.length === 0) return failure("invalid_input", "A Person identifier is required.");
    const lookup = await this.deps.personRepository.findById(personId);
    if (lookup.kind === "not_found") return failure("person_not_found", "No Person exists for this identifier.");
    if (lookup.kind === "unavailable") return failure("persistence_unavailable", lookup.detail ?? "Person storage is unavailable.");
    if (lookup.kind === "invalid_persistence_state") return failure("invalid_persistence_state", lookup.detail ?? "Stored Person data is invalid.");

    const expectedVersion = lookup.person.version;
    const changed = deactivatePerson(lookup.person, {
      now: this.deps.clock.now(),
      eventId: this.deps.idGenerator.next("DomainEvent"),
    });
    if (!changed.ok) return failure("invalid_transition", changed.error.message);
    const saved = await this.deps.personRepository.save(changed.value.person, expectedVersion);
    if (!saved.ok) {
      if (saved.error.kind === "not_found") return failure("person_not_found", "The Person no longer exists.");
      if (saved.error.kind === "concurrency_conflict") return failure("concurrency_conflict", "The Person changed after it was loaded.");
      if (saved.error.kind === "invalid_persistence_state") return failure("invalid_persistence_state", saved.error.detail ?? "Stored Person data is invalid.");
      if (saved.error.kind === "unavailable") return failure("persistence_unavailable", saved.error.detail ?? "Person storage is unavailable.");
      return failure("invalid_persistence_state", "Person storage rejected an impossible save outcome.");
    }
    await this.deps.domainEvents.publish(changed.value.event);
    return { ok: true, value: { person: saved.value, event: changed.value.event } };
  }
}

function failure(kind: DeactivatePersonErrorKind, message: string): Result<never, DeactivatePersonError> {
  return { ok: false, error: { kind, code: kind, message } };
}
