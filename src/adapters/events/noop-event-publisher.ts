import type { EventPublisher } from "@app/contracts/events";

/**
 * EventPublisher that discards everything. Useful for composition paths where
 * event delivery is intentionally disabled (e.g. read-only tooling).
 */
export class NoopEventPublisher<E> implements EventPublisher<E> {
  async publish(_event: E): Promise<void> {
    /* intentionally no-op */
  }

  async publishAll(_events: readonly E[]): Promise<void> {
    /* intentionally no-op */
  }
}
