import type { Id } from "@shared/kernel";
import type { CompetitionMeasure } from "@shared/measurement";

/**
 * Sport — a top-level sport (e.g. Basketball, Swimming, Track & Field).
 * Discipline — a specialised branch within a sport (e.g. 100m within Track).
 *
 * Ownership: platform-global reference data (ADR-010). Not tenant-scoped.
 * A future controlled customization model may allow tenant-specific extensions.
 *
 * Athlete↔Sport participation is modelled in the separate Athlete context
 * (ADR-019), which references a Sport only by `Id<"Sport">`. This context owns
 * the catalog; it does not know about athletes.
 */
export interface Sport {
  readonly id: Id<"Sport">;
  readonly code: string;
  readonly name: string;
}

export interface Discipline {
  readonly id: Id<"Discipline">;
  readonly sportId: Id<"Sport">;
  readonly code: string;
  readonly name: string;
  readonly measure: CompetitionMeasure;
}
