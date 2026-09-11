import type { SportsIdGenerator } from "@app/contracts/sports-id-generator";
import type { Id } from "@shared/kernel";

/**
 * Deterministic Sports ID generator for tests. By default it produces stable,
 * human-readable values with an incrementing counter ("SID-TEST-1", ...).
 *
 * `enqueue` forces the next value(s), which lets a test simulate a Sports ID
 * collision (queue a value the repository already holds, then let the counter
 * produce a fresh one) without any randomness.
 */
export class FakeSportsIdGenerator implements SportsIdGenerator {
  private counter = 0;
  private readonly queued: Array<Id<"SportsId">> = [];

  constructor(private readonly prefix: string = "SID-TEST") {}

  next(): Id<"SportsId"> {
    const queued = this.queued.shift();
    if (queued !== undefined) return queued;
    this.counter += 1;
    return `${this.prefix}-${this.counter}` as Id<"SportsId">;
  }

  /** Force the next generated value(s), in order. */
  enqueue(...values: string[]): void {
    for (const value of values) this.queued.push(value as Id<"SportsId">);
  }

  reset(): void {
    this.counter = 0;
    this.queued.length = 0;
  }
}
