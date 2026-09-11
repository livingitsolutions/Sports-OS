import type { Id, Result } from "@shared/kernel";
import type { Person } from "@domain/identity/identity.types";

/**
 * Persistence outcomes expressed in application terms. Adapter/database errors
 * (driver exceptions, unique-constraint names, connection failures) must be
 * translated into these before they reach a use case — the domain and use case
 * never see raw infrastructure errors.
 */
export type PersonPersistenceError =
  | { readonly kind: "duplicate_person_id" }
  | { readonly kind: "duplicate_sports_id" }
  | { readonly kind: "unavailable"; readonly detail?: string };

/**
 * PersonRepository — a context-specific persistence contract for the identity
 * context. It exposes ONLY the operations this vertical slice needs, not a
 * generic CRUD surface.
 *
 * `create` is responsible for enforcing global uniqueness of both the Person ID
 * and the Sports ID at the storage boundary (the last line of defence behind
 * the use case's pre-check), and reports a conflict as a typed result rather
 * than throwing or silently overwriting.
 */
export interface PersonRepository {
  create(person: Person): Promise<Result<Person, PersonPersistenceError>>;
  findBySportsId(sportsId: Id<"SportsId">): Promise<Person | null>;
  /**
   * Existence/identity lookup. Used by other contexts' use cases (through the
   * application layer) that must confirm a Person exists before acting — e.g.
   * creating an AthleteProfile. Returns `null` when no such Person exists.
   */
  findById(personId: Id<"Person">): Promise<Person | null>;
}
