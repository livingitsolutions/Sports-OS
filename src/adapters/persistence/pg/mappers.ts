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
import type { AggregateVersion } from "@domain/aggregate";
import { isValidOrganizationState } from "@domain/organization/organization";
import type { Organization, OrganizationStatus, OrganizationType } from "@domain/organization/organization.types";

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
  readonly version: number;
  readonly updated_at: Date;
  readonly sports_id_value: string | null;
  readonly sports_id_issued_at: Date | null;
  readonly sports_id_status: string | null;
}

export function toPerson(row: PersonRow): Person | null {
  if (
    typeof row.id !== "string" || row.id.length === 0 ||
    typeof row.display_name !== "string" || row.display_name.trim().length === 0 ||
    !["active", "deactivated", "archived", "anonymized"].includes(row.lifecycle_status) ||
    !Number.isInteger(row.version) || row.version < 1 ||
    !(row.updated_at instanceof Date) || Number.isNaN(row.updated_at.getTime()) ||
    row.sports_id_value === null || row.sports_id_issued_at === null ||
    !["active", "revoked"].includes(row.sports_id_status ?? "")
  ) return null;
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
    version: row.version as AggregateVersion,
    updatedAt: row.updated_at.toISOString() as ISODateString,
    sportsId,
    displayName: row.display_name,
    dateOfBirth: row.date_of_birth,
    lifecycleStatus: row.lifecycle_status as PersonLifecycleStatus,
  };
}

export interface OrganizationRow { readonly id: string; readonly name: string; readonly slug: string; readonly type: string; readonly status: string; readonly country_code: string; readonly version: number; readonly created_at: Date; readonly updated_at: Date; }
export function toOrganization(row: OrganizationRow): Organization | null {
  if (!(row.created_at instanceof Date) || !(row.updated_at instanceof Date)) return null;
  const value: Organization = { id: row.id as Id<"Organization">, name: row.name, slug: row.slug, type: row.type as OrganizationType, status: row.status as OrganizationStatus, countryCode: row.country_code, version: row.version as AggregateVersion, createdAt: row.created_at.toISOString() as ISODateString, updatedAt: row.updated_at.toISOString() as ISODateString };
  return isValidOrganizationState(value) ? value : null;
}

export interface AthleteProfileRow {
  readonly id: string;
  readonly person_id: string;
  readonly status: string;
  readonly created_at: Date;
  readonly version: number;
}

export function toAthleteProfile(row: AthleteProfileRow): AthleteProfile {
  return {
    id: row.id as Id<"AthleteProfile">,
    version: row.version as AggregateVersion,
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
