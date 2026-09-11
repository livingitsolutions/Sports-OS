# ADR 002 — Person and Sports ID

## Status

Accepted

## Date

2026-09-08

## Context

SportsOS requires a permanent identity for every person that survives account
lifecycle changes (password resets, re-registration, soft-delete) and that is
independent of any sport role. The platform must also support minors who may
not have their own login, and must guarantee that historical records never
disappear when an account is deleted (R20). Finally, QR credentials must
identify a person without carrying sensitive data (R8).

The key tension: authentication accounts come and go, but sporting identity
must be permanent and auditable.

## Decision

Separate three concepts:

1. **Person** — the permanent natural/legal identity. Owns the Sports ID.
   Survives account closure via a layered lifecycle (deactivation → archival →
   anonymization) [C]. [S3] Guardian relationships are NOT a field on Person
   (no `guardianId`); they are a separate `GuardianRelationship` (see ADR-019,
   `identity-model.md`).
   **Platform-global** [C] — no `tenantId`; does not belong to any org/event.
2. **User** — an authentication subject (credential holder). Tied to a login
   account; can be disabled/recreated. A minor may have no User; a guardian's
   User acts on their behalf. Never the source of identity.
3. **Sports ID** — a permanent, platform-issued identifier. One per Person
   (R2). Never reissued to another Person. Revocable but never reused.
   **Platform-global** [C] — not tenant/organization-owned. Separate from
   QrCredential (see ADR-007, ADR-010).

Additionally:
- A Person **MAY** have at most one `AthleteProfile` (sport-independent,
  optional — see ADR-003) [C]. A Person does not automatically become an
  athlete.
- Account closure is layered: disable User, revoke QR credentials, deactivate
  Person, then archive; after retention, anonymize [C]. Historical records
  are preserved throughout. See ADR-011.
- QR credentials reference the Person by an opaque token; they carry no
  profile data (R8, ADR-007). SportsId and QrCredential are separate [C].

See `identity-model.md`.

## Consequences

**Positive:**
- Identity is stable and auditable regardless of account churn.
- Minor/guardian flows are first-class.
- Historical records are safe from account deletion.
- QR trust is decoupled from sensitive data.

**Negative:**
- Slightly more entities to model (Person vs User vs Athlete).
- Must enforce "one Sports ID per Person" and "at most one AthleteProfile
  per Person" [C] invariants at the application/adapter layer.
- Retention/anonymization policy must be defined per jurisdiction [C].

## Alternatives considered

- **Single `User` entity holding everything.** Rejected: account deletion
  would orphan history; sport identity would be coupled to login; minors
  would be awkward.
- **Sports ID as a property of Athlete.** Rejected: Sports ID is sport-
  independent (R3) and belongs to the Person, not a sport role.
- **Generate Sports IDs client-side.** Rejected: must be platform-issued to
  guarantee uniqueness and permanence.

## Compliance

- `Person.sportsId` is `SportsId | null` (issued once).
- [S3] `Person` carries no `guardianId`; guardian links are a separate
  `GuardianRelationship` (ADR-019).
- `Person` has no `tenantId` [C] — platform-global.
- `Person.lifecycleStatus` tracks layered lifecycle [C].
- Application layer enforces one-Sports-ID-per-Person and at-most-one-AthleteProfile-per-Person [C].
- Layered retention model documented in `audit-integrity.md`, ADR-011 [C].
- **[S2]** The `createPerson` domain factory constructs a valid, active Person
  and issues exactly one `SportsId` in the same operation; there is no path to
  an active Person without a Sports ID, and no operation replaces a Sports ID.
- **[S2]** The `CreatePerson` use case generates the Person ID and a
  platform-issued Sports ID (via `SportsIdGenerator`), verifies Sports ID
  uniqueness with bounded retry, and persists via `PersonRepository`; the Sports
  ID value is opaque and carries no sensitive data.
