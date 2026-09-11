import type { IdGenerator } from "@app/contracts/id-generator";
import type { Id } from "@shared/kernel";

/**
 * Production IdGenerator backed by the platform's cryptographically-strong UUID
 * source. Available in browsers and modern Node without a domain dependency.
 */
export class UuidIdGenerator implements IdGenerator {
  next<B extends string>(_brand: B): Id<B> {
    return crypto.randomUUID() as Id<B>;
  }
}
