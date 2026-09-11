import type { EventPublisher } from "@app/contracts/events";

/**
 * In-memory EventPublisher. Records everything published so tests can assert on
 * emitted events. Sufficient for wiring and future use-case tests; it is NOT a
 * production message broker (a broker adapter arrives in a later sprint).
 */
export class InMemoryEventPublisher<E> implements EventPublisher<E> {
  private readonly recorded: E[] = [];

  async publish(event: E): Promise<void> {
    this.recorded.push(event);
  }

  async publishAll(events: readonly E[]): Promise<void> {
    for (const event of events) {
      this.recorded.push(event);
    }
  }

  /** All events published so far, in order. */
  get events(): readonly E[] {
    return this.recorded;
  }

  clear(): void {
    this.recorded.length = 0;
  }
}
