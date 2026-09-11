import type { AggregateVersion } from "@domain/aggregate";
import type { Person } from "@domain/identity/identity.types";
import type { Id, Result } from "@shared/kernel";

export type PersonPersistenceError =
  | { readonly kind: "duplicate_person_id" }
  | { readonly kind: "duplicate_sports_id" }
  | { readonly kind: "not_found" }
  | { readonly kind: "concurrency_conflict" }
  | { readonly kind: "invalid_persistence_state"; readonly detail?: string }
  | { readonly kind: "unavailable"; readonly detail?: string };

export type PersonLookupResult =
  | { readonly kind: "found"; readonly person: Person }
  | { readonly kind: "not_found" }
  | { readonly kind: "unavailable"; readonly detail?: string }
  | { readonly kind: "invalid_persistence_state"; readonly detail?: string };

export interface PersonRepository {
  create(person: Person): Promise<Result<Person, PersonPersistenceError>>;
  findBySportsId(sportsId: Id<"SportsId">): Promise<PersonLookupResult>;
  findById(personId: Id<"Person">): Promise<PersonLookupResult>;
  save(person: Person, expectedVersion: AggregateVersion): Promise<Result<Person, PersonPersistenceError>>;
}
