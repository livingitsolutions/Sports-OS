import type {
  PersonPersistenceError,
  PersonRepository,
} from "@app/contracts/person-repository";
import type { Person } from "@domain/identity/identity.types";
import type { Id, Result } from "@shared/kernel";

/**
 * In-memory PersonRepository.
 *
 * It models the semantics a real (future Postgres/Supabase) implementation must
 * guarantee, so use-case tests exercise the same rules production will enforce:
 *  - a duplicate Person ID is rejected (`duplicate_person_id`);
 *  - a duplicate Sports ID is rejected (`duplicate_sports_id`);
 *  - a successful create never silently overwrites an existing row;
 *  - a Person is retrievable by its Sports ID.
 *
 * It is NOT durable storage. Any production wiring that uses it is explicitly
 * temporary until a persistent adapter exists.
 */
export class InMemoryPersonRepository implements PersonRepository {
  private readonly byPersonId = new Map<string, Person>();
  private readonly personIdBySportsId = new Map<string, string>();

  async create(person: Person): Promise<Result<Person, PersonPersistenceError>> {
    if (this.byPersonId.has(person.id)) {
      return { ok: false, error: { kind: "duplicate_person_id" } };
    }
    const sportsId = person.sportsId?.value ?? null;
    if (sportsId !== null && this.personIdBySportsId.has(sportsId)) {
      return { ok: false, error: { kind: "duplicate_sports_id" } };
    }
    this.byPersonId.set(person.id, person);
    if (sportsId !== null) this.personIdBySportsId.set(sportsId, person.id);
    return { ok: true, value: person };
  }

  async findBySportsId(sportsId: Id<"SportsId">): Promise<Person | null> {
    const personId = this.personIdBySportsId.get(sportsId);
    if (personId === undefined) return null;
    return this.byPersonId.get(personId) ?? null;
  }

  async findById(personId: Id<"Person">): Promise<Person | null> {
    return this.byPersonId.get(personId) ?? null;
  }

  /** Inspection helper for tests: number of stored persons. */
  get size(): number {
    return this.byPersonId.size;
  }
}
