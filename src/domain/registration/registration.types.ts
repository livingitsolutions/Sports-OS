import type { Id } from "@shared/kernel";

/**
 * Registration boundary (see ADR-008, docs/architecture/registration-model.md).
 *
 * Key invariant: the PARTICIPANT (who competes) and the PAYER (who pays the
 * entry fee) are separate concepts. A guardian may pay for a minor athlete.
 *
 * Ownership: event-scoped (tenant-owned, tied to an Event).
 */
export type RegistrationStatus =
  | "draft"
  | "submitted"
  | "verified"
  | "rejected"
  | "withdrawn";

export interface Registration {
  readonly id: Id<"Registration">;
  readonly tenantId: Id<"Tenant">;
  readonly eventId: Id<"Event">;
  readonly participantKind: "individual" | "team";
  readonly participantId: Id<"AthleteProfile"> | Id<"Team">;
  readonly payerPersonId: Id<"Person">;
  readonly status: RegistrationStatus;
}
