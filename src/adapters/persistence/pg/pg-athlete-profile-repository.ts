import type {
  AthleteProfilePersistenceError,
  AthleteProfileRepository,
} from "@app/contracts/athlete-profile-repository";
import type {
  AthleteProfile,
  AthleteSportParticipation,
} from "@domain/athlete/athlete.types";
import type { Id, Result } from "@shared/kernel";
import type { Sql } from "@adapters/persistence/pg/connection";
import {
  isForeignKeyViolation,
  isUniqueViolation,
  neutralDetail,
  pgErrorInfo,
} from "@adapters/persistence/pg/errors";
import type {
  AthleteProfileRow,
  ParticipationRow,
} from "@adapters/persistence/pg/mappers";
import {
  toAthleteProfile,
  toParticipation,
} from "@adapters/persistence/pg/mappers";

/**
 * PostgreSQL AthleteProfileRepository.
 *
 * Uniqueness invariants are enforced by database constraints as the final guard
 * behind the use-case pre-checks, and every conflict is translated into a typed
 * `AthleteProfilePersistenceError`:
 *  - profile primary key -> `duplicate_athlete_profile_id`;
 *  - one-profile-per-person unique constraint -> `person_already_has_profile`;
 *  - the partial unique index on active participation
 *    (`uq_active_participation_per_sport`) -> `already_participating`.
 *
 * Ended participation rows are never overwritten; a returning athlete inserts a
 * new active row, which the partial index permits once no active row exists. No
 * driver error escapes this adapter.
 */
export class PgAthleteProfileRepository implements AthleteProfileRepository {
  constructor(private readonly sql: Sql) {}

  async create(
    profile: AthleteProfile,
  ): Promise<Result<AthleteProfile, AthleteProfilePersistenceError>> {
    try {
      await this.sql`
        INSERT INTO athlete_profiles (id, person_id, status, created_at)
        VALUES (
          ${profile.id},
          ${profile.personId},
          ${profile.status},
          ${profile.createdAt}
        )
      `;
      return { ok: true, value: profile };
    } catch (err) {
      return { ok: false, error: mapProfileCreateError(err) };
    }
  }

  async findById(id: Id<"AthleteProfile">): Promise<AthleteProfile | null> {
    const rows = await this.read(
      () => this.sql<AthleteProfileRow[]>`
        SELECT id, person_id, status, created_at
        FROM athlete_profiles
        WHERE id = ${id}
        LIMIT 1
      `,
    );
    const row = rows[0];
    return row !== undefined ? toAthleteProfile(row) : null;
  }

  async findByPersonId(
    personId: Id<"Person">,
  ): Promise<AthleteProfile | null> {
    const rows = await this.read(
      () => this.sql<AthleteProfileRow[]>`
        SELECT id, person_id, status, created_at
        FROM athlete_profiles
        WHERE person_id = ${personId}
        LIMIT 1
      `,
    );
    const row = rows[0];
    return row !== undefined ? toAthleteProfile(row) : null;
  }

  async addParticipation(
    participation: AthleteSportParticipation,
  ): Promise<Result<AthleteSportParticipation, AthleteProfilePersistenceError>> {
    try {
      await this.sql`
        INSERT INTO athlete_sport_participations
          (id, athlete_profile_id, sport_id, status, started_at, ended_at)
        VALUES (
          ${participation.id},
          ${participation.athleteProfileId},
          ${participation.sportId},
          ${participation.status},
          ${participation.startedAt},
          ${participation.endedAt}
        )
      `;
      return { ok: true, value: participation };
    } catch (err) {
      return { ok: false, error: mapParticipationError(err) };
    }
  }

  async findActiveParticipation(
    athleteProfileId: Id<"AthleteProfile">,
    sportId: Id<"Sport">,
  ): Promise<AthleteSportParticipation | null> {
    const rows = await this.read(
      () => this.sql<ParticipationRow[]>`
        SELECT id, athlete_profile_id, sport_id, status, started_at, ended_at
        FROM athlete_sport_participations
        WHERE athlete_profile_id = ${athleteProfileId}
          AND sport_id = ${sportId}
          AND status = 'active'
        LIMIT 1
      `,
    );
    const row = rows[0];
    return row !== undefined ? toParticipation(row) : null;
  }

  async listParticipations(
    athleteProfileId: Id<"AthleteProfile">,
  ): Promise<readonly AthleteSportParticipation[]> {
    const rows = await this.read(
      () => this.sql<ParticipationRow[]>`
        SELECT id, athlete_profile_id, sport_id, status, started_at, ended_at
        FROM athlete_sport_participations
        WHERE athlete_profile_id = ${athleteProfileId}
        ORDER BY started_at ASC
      `,
    );
    return rows.map(toParticipation);
  }

  private async read<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      throw new Error(`athlete_repository_read_failed: ${neutralDetail(err)}`);
    }
  }
}

function mapProfileCreateError(err: unknown): AthleteProfilePersistenceError {
  const info = pgErrorInfo(err);
  if (isUniqueViolation(info) && info !== null) {
    if (info.constraint.includes("person_id")) {
      return { kind: "person_already_has_profile" };
    }
    return { kind: "duplicate_athlete_profile_id" };
  }
  return { kind: "unavailable", detail: neutralDetail(err) };
}

function mapParticipationError(err: unknown): AthleteProfilePersistenceError {
  const info = pgErrorInfo(err);
  if (isUniqueViolation(info)) {
    return { kind: "already_participating" };
  }
  if (isForeignKeyViolation(info) && info !== null) {
    if (info.constraint.includes("athlete_profile_id")) {
      return { kind: "athlete_profile_not_found" };
    }
  }
  return { kind: "unavailable", detail: neutralDetail(err) };
}
