import type { ISODateString } from "@shared/kernel";
import type { DomainEvent } from "@domain/aggregate";

export type { DomainEvent } from "@domain/aggregate";

/**
 * IntegrationEvent — an application-boundary message suitable for delivery
 * OUTSIDE the originating bounded context. Distinct from a DomainEvent:
 *
 * - A `DomainEvent` (defined in the domain layer) is a completed fact inside a
 *   single bounded context. It is expressed in that context's language and is
 *   not a transport concern.
 * - An `IntegrationEvent` is a versioned, self-describing contract used to
 *   communicate across context boundaries. The application layer translates
 *   selected domain events into integration events.
 *
 * This separation keeps domain events free to evolve internally without
 * breaking external consumers, which depend only on integration contracts.
 */
export interface IntegrationEvent {
  readonly eventId: string;
  readonly occurredAt: ISODateString;
  /** Fully-qualified event name, e.g. "results.result_confirmed". */
  readonly eventType: string;
  /** Originating bounded context, e.g. "results". */
  readonly source: string;
  /** Contract version, bumped on breaking payload changes. */
  readonly version: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * EventPublisher — application-owned capability contract for emitting events.
 * Generic over the event type so the same contract serves both domain-event
 * fan-out and integration-event delivery. Adapters implement it (in-memory for
 * tests; a real broker adapter arrives in a later sprint — NOT this one).
 */
export interface EventPublisher<E> {
  publish(event: E): Promise<void>;
  publishAll(events: readonly E[]): Promise<void>;
}

export type DomainEventPublisher = EventPublisher<DomainEvent>;
export type IntegrationEventPublisher = EventPublisher<IntegrationEvent>;
