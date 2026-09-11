import type { Id, ISODateString } from "@shared/kernel";

/**
 * Athlete context types.
 *
 * The Athlete context is a distinct bounded context (ADR-019). It models a
 * Person's optional *sporting* identity and their participation in sports. It
 * references the Identity context (`Id<"Person">`) and the Sports Catalog
 * (`Id<"Sport">`) ONLY by immutable shared identifiers — never by importing
 * another context's internals.
 *
 * It deliberately does NOT duplicate any Person identity data (display name,
 * date of birth, Sports ID). Person remains the single source of personal
 * identity; AthleteProfile references it by `personId`.
 */

export type AthleteProfileStatus = "active" | "inactive";

/**
 * AthleteProfile — a sport-independent, person-level sporting identity.
 *
 * Invariants (see docs/architecture/identity-model.md, ADR-003, ADR-019):
 *  - a Person MAY have at most one AthleteProfile (optional; a Person does not
 *    automatically become an athlete);
 *  - it is platform/person-level, NOT tenant-owned and NOT sport-specific;
 *  - it links to exactly one Person by `personId`;
 *  - it holds NO Person identity fields (no name, date of birth, or Sports ID).
 *
 * The single profile supports participation in multiple sports simultaneously
 * through `AthleteSportParticipation` — there is never one profile per sport.
 */
export interface AthleteProfile {
  readonly id: Id<"AthleteProfile">;
  readonly personId: Id<"Person">;
  readonly status: AthleteProfileStatus;
  readonly createdAt: ISODateString;
}

export type ParticipationStatus = "active" | "ended";

/**
 * AthleteSportParticipation — the many-to-many relationship stating that an
 * athlete participates in a sport. It references the Sport by identifier and
 * copies no Sport data.
 *
 * This is NOT tournament participation, registration, competition entry, team
 * membership, or any result/ranking/achievement history. Leaving a sport is
 * modelled non-destructively via `status: "ended"` + `endedAt`; participation
 * history is never deleted.
 */
export interface AthleteSportParticipation {
  readonly id: Id<"AthleteSportParticipation">;
  readonly athleteProfileId: Id<"AthleteProfile">;
  readonly sportId: Id<"Sport">;
  readonly status: ParticipationStatus;
  readonly startedAt: ISODateString;
  readonly endedAt: ISODateString | null;
}
