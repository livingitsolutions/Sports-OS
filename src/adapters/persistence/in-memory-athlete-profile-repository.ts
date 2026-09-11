import type {
  AthleteProfilePersistenceError,
  AthleteProfileRepository,
} from "@app/contracts/athlete-profile-repository";
import type {
  AthleteProfile,
  AthleteSportParticipation,
} from "@domain/athlete/athlete.types";
import type { Id, Result } from "@shared/kernel";

/**
 * In-memory AthleteProfileRepository.
 *
 * It models the uniqueness semantics a real (future Postgres/Supabase)
 * implementation must guarantee, so use-case tests exercise the same rules
 * production will enforce:
 *  - a duplicate AthleteProfile ID is rejected (`duplicate_athlete_profile_id`);
 *  - a second AthleteProfile for the same Person is rejected
 *    (`person_already_has_profile`);
 *  - a second ACTIVE participation in the same sport is rejected
 *    (`already_participating`);
 *  - a successful write never silently overwrites existing data.
 *
 * It is NOT durable storage. Any production wiring that uses it is explicitly
 * temporary until a persistent adapter exists.
 */
export class InMemoryAthleteProfileRepository
  implements AthleteProfileRepository
{
  private readonly byId = new Map<string, AthleteProfile>();
  private readonly idByPersonId = new Map<string, string>();
  private readonly participations = new Map<string, AthleteSportParticipation>();

  async create(
    profile: AthleteProfile,
  ): Promise<Result<AthleteProfile, AthleteProfilePersistenceError>> {
    if (this.byId.has(profile.id)) {
      return { ok: false, error: { kind: "duplicate_athlete_profile_id" } };
    }
    if (this.idByPersonId.has(profile.personId)) {
      return { ok: false, error: { kind: "person_already_has_profile" } };
    }
    this.byId.set(profile.id, profile);
    this.idByPersonId.set(profile.personId, profile.id);
    return { ok: true, value: profile };
  }

  async findById(id: Id<"AthleteProfile">): Promise<AthleteProfile | null> {
    return this.byId.get(id) ?? null;
  }

  async findByPersonId(
    personId: Id<"Person">,
  ): Promise<AthleteProfile | null> {
    const id = this.idByPersonId.get(personId);
    if (id === undefined) return null;
    return this.byId.get(id) ?? null;
  }

  async addParticipation(
    participation: AthleteSportParticipation,
  ): Promise<Result<AthleteSportParticipation, AthleteProfilePersistenceError>> {
    if (this.participations.has(participation.id)) {
      return { ok: false, error: { kind: "already_participating" } };
    }
    if (!this.byId.has(participation.athleteProfileId)) {
      return { ok: false, error: { kind: "athlete_profile_not_found" } };
    }
    const activeConflict = this.findActiveIn(
      participation.athleteProfileId,
      participation.sportId,
    );
    if (activeConflict !== null) {
      return { ok: false, error: { kind: "already_participating" } };
    }
    this.participations.set(participation.id, participation);
    return { ok: true, value: participation };
  }

  async findActiveParticipation(
    athleteProfileId: Id<"AthleteProfile">,
    sportId: Id<"Sport">,
  ): Promise<AthleteSportParticipation | null> {
    return this.findActiveIn(athleteProfileId, sportId);
  }

  async listParticipations(
    athleteProfileId: Id<"AthleteProfile">,
  ): Promise<readonly AthleteSportParticipation[]> {
    return [...this.participations.values()].filter(
      (p) => p.athleteProfileId === athleteProfileId,
    );
  }

  /** Inspection helper for tests: number of stored profiles. */
  get size(): number {
    return this.byId.size;
  }

  private findActiveIn(
    athleteProfileId: Id<"AthleteProfile">,
    sportId: Id<"Sport">,
  ): AthleteSportParticipation | null {
    for (const p of this.participations.values()) {
      if (
        p.athleteProfileId === athleteProfileId &&
        p.sportId === sportId &&
        p.status === "active"
      ) {
        return p;
      }
    }
    return null;
  }
}
