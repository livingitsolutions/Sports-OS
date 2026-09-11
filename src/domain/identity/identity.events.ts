import type { DomainEvent } from "@domain/aggregate";
import type { Id } from "@shared/kernel";

/**
 * Identity-context domain events. Each represents a completed fact.
 *
 * These are separate events on purpose: "a Person now exists" and "a Sports ID
 * was issued" are distinct facts that downstream contexts may react to
 * independently (e.g. a future credential context cares about SportsIdIssued,
 * not PersonCreated). Both are produced together by `createPerson` because this
 * platform never creates an active Person without a Sports ID.
 *
 * Payloads carry only identifiers and issuance facts — NEVER display name,
 * date of birth, guardian, or any other personal data.
 */
export interface PersonCreated extends DomainEvent {
  readonly type: "identity.person_created";
  readonly aggregateType: "Person";
  readonly personId: Id<"Person">;
}

export interface SportsIdIssued extends DomainEvent {
  readonly type: "identity.sports_id_issued";
  readonly aggregateType: "Person";
  readonly personId: Id<"Person">;
  readonly sportsId: Id<"SportsId">;
}

export type IdentityDomainEvent = PersonCreated | SportsIdIssued;
