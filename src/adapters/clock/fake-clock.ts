import type { Clock } from "@app/contracts/clock";
import type { ISODateString } from "@shared/kernel";

/**
 * Deterministic Clock for tests. Starts at a fixed instant and only moves when
 * explicitly advanced or set, so time-dependent behavior is reproducible.
 */
export class FakeClock implements Clock {
  private currentMs: number;

  constructor(start: string | number | Date = "2026-01-01T00:00:00.000Z") {
    this.currentMs = new Date(start).getTime();
  }

  now(): ISODateString {
    return new Date(this.currentMs).toISOString() as ISODateString;
  }

  /** Move the clock forward by a number of milliseconds. */
  advance(ms: number): void {
    this.currentMs += ms;
  }

  /** Set the clock to an absolute instant. */
  set(instant: string | number | Date): void {
    this.currentMs = new Date(instant).getTime();
  }
}
