import type { IdGenerator } from "@app/contracts/id-generator";
import type { Id } from "@shared/kernel";

/**
 * Deterministic IdGenerator for tests. Produces stable, human-readable IDs with
 * a per-brand incrementing counter, so a test that creates the first Person
 * always sees the same id (e.g. "test-Person-1").
 */
export class FakeIdGenerator implements IdGenerator {
  private readonly counters = new Map<string, number>();

  constructor(private readonly prefix: string = "test") {}

  next<B extends string>(brand: B): Id<B> {
    const nextValue = (this.counters.get(brand) ?? 0) + 1;
    this.counters.set(brand, nextValue);
    return `${this.prefix}-${brand}-${nextValue}` as Id<B>;
  }

  /** Reset all counters so a fresh test starts from 1 again. */
  reset(): void {
    this.counters.clear();
  }
}
