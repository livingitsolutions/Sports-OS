import type { Id, Result } from "@shared/kernel";
import type {
  AthleteProfile,
  AthleteSportParticipation,
} from "@domain/athlete/athlete.types";

/**
 * Persistence outcomes for the Athlete context, expressed in application terms.
 * Adapter/database errors must be translated into these before they reach a use
 * case — the domain and use case never see raw infrastructure errors.
 */
export type AthleteProfilePersistenceError =
  | { readonly kind: "duplicate_athlete_profile_id" }
  | { readonly kind: "person_already_has_profile" }
  | { readonly kind: "athlete_profile_not_found" }
  | { readonly kind: "already_participating" }
  | { readonly kind: "unavailable"; readonly detail?: string };

/**
 * AthleteProfileRepository — a context-specific persistence contract for the
 * Athlete context. It exposes ONLY the operations the Sprint 3 use cases need,
 * not a generic CRUD surface.
 *
 * Uniqueness the storage boundary MUST enforce (the last line of defence behind
 * the use-case pre-checks), reporting conflicts as typed results rather than
 * throwing or silently overwriting:
 *  - one AthleteProfile per `id` (`duplicate_athlete_profile_id`);
 *  - at most one AthleteProfile per Person (`person_already_has_profile`);
 *  - at most one ACTIVE participation per (profile, sport) pair
 *    (`already_participating`).
 *
 * Participation is never destructively deleted; leaving a sport is a lifecycle
 * change (`status: "ended"`), which is out of scope for Sprint 3.
 */
export interface AthleteProfileRepository {
  create(
    profile: AthleteProfile,
  ): Promise<Result<AthleteProfile, AthleteProfilePersistenceError>>;

  findById(id: Id<"AthleteProfile">): Promise<AthleteProfile | null>;

  findByPersonId(personId: Id<"Person">): Promise<AthleteProfile | null>;

  addParticipation(
    participation: AthleteSportParticipation,
  ): Promise<Result<AthleteSportParticipation, AthleteProfilePersistenceError>>;

  findActiveParticipation(
    athleteProfileId: Id<"AthleteProfile">,
    sportId: Id<"Sport">,
  ): Promise<AthleteSportParticipation | null>;

  listParticipations(
    athleteProfileId: Id<"AthleteProfile">,
  ): Promise<readonly AthleteSportParticipation[]>;
}
