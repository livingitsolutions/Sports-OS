import type { Id, ISODateString } from "@shared/kernel";

/**
 * QR credential trust model (see ADR-007,
 * docs/architecture/qr-credentials-model.md).
 *
 * Permanent Sports ID QR and temporary/dynamic event credentials are SEPARATE
 * (invariant 9). A QR identifies a person but must NOT carry sensitive data
 * (invariant 8). QR identity, biometric/device auth, and identity verification
 * are separate concepts (invariant 10).
 *
 * SportsId and QrCredential are separate concepts. SportsId may be permanent.
 * QR credentials support a full lifecycle (issued, active, expired, revoked,
 * replaced, compromised) and are rotatable/revocable without changing the
 * Person's SportsId.
 */

export type QrCredentialKind = "permanent_sports_id" | "event_credential";

/**
 * Credential lifecycle states. A credential moves through these states; the
 * SportsId itself is unaffected by credential lifecycle changes.
 */
export type QrCredentialStatus =
  | "issued"
  | "active"
  | "expired"
  | "revoked"
  | "replaced"
  | "compromised";

export interface QrCredential {
  readonly id: Id<"QrCredential">;
  readonly personId: Id<"Person">;
  readonly kind: QrCredentialKind;
  readonly payloadToken: string;
  readonly status: QrCredentialStatus;
  readonly expiresAt: ISODateString | null;
  readonly issuedAt: ISODateString;
  readonly rotatedAt: ISODateString | null;
  readonly revokedAt: ISODateString | null;
  readonly replacedById: Id<"QrCredential"> | null;
}

export type IdentityVerificationLevel = "none" | "self" | "document" | "verified";

export interface IdentityVerification {
  readonly id: Id<"IdentityVerification">;
  readonly personId: Id<"Person">;
  readonly level: IdentityVerificationLevel;
  readonly verifiedAt: ISODateString | null;
}
