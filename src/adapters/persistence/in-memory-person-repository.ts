import type { PersonLookupResult, PersonPersistenceError, PersonRepository } from "@app/contracts/person-repository";
import type { AggregateVersion } from "@domain/aggregate";
import type { Person } from "@domain/identity/identity.types";
import type { Id, Result } from "@shared/kernel";

/** In-memory semantic twin of the PostgreSQL Person adapter. */
export class InMemoryPersonRepository implements PersonRepository {
  private readonly byPersonId = new Map<string, Person>();
  private readonly personIdBySportsId = new Map<string, string>();

  async create(person: Person): Promise<Result<Person, PersonPersistenceError>> {
    if (person.version !== 1) return invalidState("A new Person must be version 1.");
    if (this.byPersonId.has(person.id)) return failure("duplicate_person_id");
    const sportsId = person.sportsId?.value ?? null;
    if (sportsId === null) return invalidState("A Person must carry a Sports ID.");
    if (this.personIdBySportsId.has(sportsId)) return failure("duplicate_sports_id");
    const stored = copy(person);
    this.byPersonId.set(person.id, stored);
    this.personIdBySportsId.set(sportsId, person.id);
    return { ok: true, value: copy(stored) };
  }

  async findBySportsId(sportsId: Id<"SportsId">): Promise<PersonLookupResult> {
    const personId = this.personIdBySportsId.get(sportsId);
    if (personId === undefined) return { kind: "not_found" };
    const person = this.byPersonId.get(personId);
    return person === undefined
      ? { kind: "invalid_persistence_state", detail: "Sports ID owner is missing." }
      : { kind: "found", person: copy(person) };
  }

  async findById(personId: Id<"Person">): Promise<PersonLookupResult> {
    const person = this.byPersonId.get(personId);
    return person === undefined ? { kind: "not_found" } : { kind: "found", person: copy(person) };
  }

  async save(person: Person, expectedVersion: AggregateVersion): Promise<Result<Person, PersonPersistenceError>> {
    if (person.version !== expectedVersion + 1) return invalidState("Updated version must be exactly expected version plus one.");
    const stored = this.byPersonId.get(person.id);
    if (stored === undefined) return failure("not_found");
    if (stored.version !== expectedVersion) return failure("concurrency_conflict");
    if (person.sportsId?.value !== stored.sportsId?.value) return invalidState("A Person save cannot replace its Sports ID.");
    const updated = copy(person);
    this.byPersonId.set(person.id, updated);
    return { ok: true, value: copy(updated) };
  }

  get size(): number { return this.byPersonId.size; }
}

function copy(person: Person): Person {
  return { ...person, sportsId: person.sportsId === null ? null : { ...person.sportsId } };
}

function failure(kind: PersonPersistenceError["kind"]): Result<never, PersonPersistenceError> {
  return { ok: false, error: { kind } as PersonPersistenceError };
}

function invalidState(detail: string): Result<never, PersonPersistenceError> {
  return { ok: false, error: { kind: "invalid_persistence_state", detail } };
}
