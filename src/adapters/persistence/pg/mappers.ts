import type {
  Person,
  PersonLifecycleStatus,
  SportsId,
  SportsIdStatus,
} from "@domain/identity/identity.types";
import type {
  AthleteProfile,
  AthleteProfileStatus,
  AthleteSportParticipation,
  ParticipationStatus,
} from "@domain/athlete/athlete.types";
import type { Id, ISODateString } from "@shared/kernel";

/**
 * Explicit row <-> domain mapping. Database row shapes never leak into the
 * domain: repositories select exactly these columns and translate them into
 * domain objects here. Infrastructure-only columns (e.g. `created_at`,
 * `version`) are intentionally NOT surfaced on domain objects, and private
 * identity data (date of birth) is only mapped for the owning Person, never for
 * athlete rows.
 */

export interface PersonRow {
  readonly id: string;
  readonly display_name: string;
  /** Selected as `date_of_birth::text`, so this is 'YYYY-MM-DD' or null. */
  readonly date_of_birth: string | null;
  readonly lifecycle_status: string;
  readonly sports_id_value: string | null;
  readonly sports_id_issued_at: Date | null;
  readonly sports_id_status: string | null;
}

export function toPerson(row: PersonRow): Person {
  const sportsId: SportsId | null =
    row.sports_id_value !== null && row.sports_id_issued_at !== null
      ? {
          value: row.sports_id_value as Id<"SportsId">,
          issuedAt: row.sports_id_issued_at.toISOString() as ISODateString,
          status: (row.sports_id_status ?? "active") as SportsIdStatus,
        }
      : null;

  return {
    id: row.id as Id<"Person">,
    sportsId,
    displayName: row.display_name,
    dateOfBirth: row.date_of_birth,
    lifecycleStatus: row.lifecycle_status as PersonLifecycleStatus,
  };
}

export interface AthleteProfileRow {
  readonly id: string;
  readonly person_id: string;
  readonly status: string;
  readonly created_at: Date;
}

export function toAthleteProfile(row: AthleteProfileRow): AthleteProfile {
  return {
    id: row.id as Id<"AthleteProfile">,
    personId: row.person_id as Id<"Person">,
    status: row.status as AthleteProfileStatus,
    createdAt: row.created_at.toISOString() as ISODateString,
  };
}

export interface ParticipationRow {
  readonly id: string;
  readonly athlete_profile_id: string;
  readonly sport_id: string;
  readonly status: string;
  readonly started_at: Date;
  readonly ended_at: Date | null;
}

export function toParticipation(
  row: ParticipationRow,
): AthleteSportParticipation {
  return {
    id: row.id as Id<"AthleteSportParticipation">,
    athleteProfileId: row.athlete_profile_id as Id<"AthleteProfile">,
    sportId: row.sport_id as Id<"Sport">,
    status: row.status as ParticipationStatus,
    startedAt: row.started_at.toISOString() as ISODateString,
    endedAt: row.ended_at !== null ? (row.ended_at.toISOString() as ISODateString) : null,
  };
}
