import type { Id, ISODateString } from "@shared/kernel";

/**
 * Aggregate root marker. Concrete aggregates live under their bounded context.
 */
export interface AggregateRoot<B extends string> {
  readonly id: Id<B>;
}

/** Value object marker. Value objects are immutable and compared by value. */
export interface ValueObject {}

/**
 * Domain event marker. Events are produced by aggregates and represent
 * something that happened inside a single bounded context. The APPLICATION
 * layer routes them (via an EventPublisher or other mechanisms) and may
 * translate selected ones into IntegrationEvents for cross-context delivery.
 * The domain itself does not depend on any port to publish events — it
 * produces them, and the application layer handles delivery.
 *
 * See ADR-017 (cross-context interaction) and the application `events`
 * contract for the DomainEvent vs IntegrationEvent distinction.
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: ISODateString;
  readonly aggregateId: string;
  readonly aggregateType: string;
}
