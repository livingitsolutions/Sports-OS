import type { Clock } from "@app/contracts/clock";
import type { ISODateString } from "@shared/kernel";

/** Production Clock backed by the system wall clock. */
export class SystemClock implements Clock {
  now(): ISODateString {
    return new Date().toISOString() as ISODateString;
  }
}
