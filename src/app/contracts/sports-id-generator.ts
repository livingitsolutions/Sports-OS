import type { Id } from "@shared/kernel";

/**
 * SportsIdGenerator — application-owned capability contract for minting the
 * public value of a permanent Sports ID.
 *
 * This is deliberately SEPARATE from the generic `IdGenerator`: a Sports ID has
 * stricter semantics than an internal identifier. An implementation MUST:
 *  - produce an opaque, collision-resistant value (never a sequential database
 *    id and never derived from a Person's data);
 *  - encode no sensitive or contextual data (no tenant, organization, person,
 *    sport, birth date, gender, or location);
 *  - never intentionally re-use a previously issued value.
 *
 * Global uniqueness is enforced by the use case + repository, not assumed here:
 * generators can still, in principle, collide, and callers must handle that.
 * The public, human-readable format is an implementation detail and is
 * versionable (see the production adapter and docs/vertical-slices/create-person.md).
 */
export interface SportsIdGenerator {
  next(): Id<"SportsId">;
}
