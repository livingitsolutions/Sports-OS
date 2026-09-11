import type { ISODateString } from "@shared/kernel";

/**
 * Clock — application-owned capability contract. The domain never reads the
 * wall clock; the application supplies timestamps as values. Implemented by
 * adapters (SystemClock in production, FakeClock in tests).
 */
export interface Clock {
  now(): ISODateString;
}
