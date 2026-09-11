import type { Id } from "@shared/kernel";

/**
 * IdGenerator — application-owned capability contract. The domain never
 * generates identifiers; the application supplies them as values. Implemented
 * by adapters (UuidIdGenerator in production, FakeIdGenerator in tests).
 */
export interface IdGenerator {
  next<B extends string>(brand: B): Id<B>;
}
