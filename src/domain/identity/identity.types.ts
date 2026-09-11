import type { Id, ISODateString } from "@shared/kernel";

/**
 * Permanent Sports ID value object.
 *
 * Invariants (see docs/architecture/identity-model.md, ADR-002):
 *  - One Person has at most one Sports ID.
 *  - The Sports ID is permanent and survives account/entity deletion.
 *  - The Sports ID is issued by the platform, never chosen by the person.
 *  - The Sports ID is platform-global identity, NOT tenant/organization-owned.
 *  - The Sports ID value encodes no sensitive data (no birth date, gender,
 *    location, sport, or organization).
 *  - SportsId and QrCredential are separate concepts (ADR-007).
 *
 * Construct via `issueSportsId` (sports-id.ts) — never build the shape by hand.
 */
export interface SportsId {
  readonly value: Id<"SportsId">;
  readonly issuedAt: ISODateString;
  readonly status: SportsIdStatus;
}

export type SportsIdStatus = "active" | "revoked";

/**
 * Person — the natural/legal identity behind every platform role.
 * A Person is NOT a User (authentication subject), NOT an AthleteProfile.
 *
 * Ownership: platform-global identity. A Person does NOT belong to the first
 * organization/event in which they participate. Person has no tenantId.
 *
 * See docs/architecture/identity-model.md, ADR-002, ADR-010.
 */
export interface Person {
  readonly id: Id<"Person">;
  readonly sportsId: SportsId | null;
  readonly displayName: string;
  /**
   * Private identity data. Retained on the Person aggregate only; it must NOT be
   * copied into AthleteProfile, emitted in any domain event, or surfaced through
   * the future public Sports Passport by default. Guardian relationships are a
   * SEPARATE concept (a GuardianRelationship in the Auth context) and are NOT
   * owned by Person.
   */
  readonly dateOfBirth: string | null;
  readonly lifecycleStatus: PersonLifecycleStatus;
}

/**
 * Person lifecycle is distinct from account closure and from identity archival.
 * See docs/architecture/audit-integrity.md, ADR-011.
 */
export type PersonLifecycleStatus =
  | "active"
  | "deactivated"
  | "archived"
  | "anonymized";
