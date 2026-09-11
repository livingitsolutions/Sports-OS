# Architecture Rules

> Mandatory architectural principles and invariants for SportsOS.
> Each rule is numbered to match the sprint brief and is normative: a PR that
> violates a rule must not be merged without an ADR superseding it.
>
> **Sprint 0.1 corrections** are marked with [C]. See ADRs 010–017 for the
> correction rationale.
>
> **[S4]** Persistence rules for the durable slice (PostgreSQL adapters, native
> constraints as the final invariant guard, aggregate versioning foundation,
> migration discipline, and the deferred-tenant-RLS decision) live in
> `../persistence-model.md`, `operations/database.md`, and ADR-020/021/022. The
> layer and dependency rules below are unchanged: the database driver is an
> adapter detail behind the existing repository contracts.

## R1. One Person may hold many platform roles.

A `Person` is the natural/legal identity. Roles are derived from scoped
memberships and assignments (`OrganizationMembership`, `OrganizationRoleAssignment`,
`TeamMembership`, `EventAssignment`, `PlatformRoleAssignment`), not a single
flat `PersonRole` aggregate. A Person may hold several roles simultaneously,
in different scopes. See `person-role-model.md`, `authorization.md`, ADR-012.

## R2. One Person has at most one Sports ID.

The Sports ID is a permanent, platform-issued identifier. It is issued once
and never reissued to a different person. The Sports ID is **platform-global
identity** [C], not tenant/organization-owned. See `identity-model.md`,
`tenancy.md`, ADR-002, ADR-010.

## R3. [C][S3] A Person MAY have at most one AthleteProfile. A Person does not automatically become an athlete.

An `AthleteProfile` is an optional sport-independent sporting identity, owned by
the dedicated **Athlete** bounded context [S3] (ADR-019), not Identity. A Person
may exist only as a coach, guardian, official, organizer, staff member, sponsor
representative, etc., with no AthleteProfile. When one exists it references the
Person by `Id<"Person">` only, carries no Person identity data (no name, date of
birth, or Sports ID), and is sport-independent (`id`, `personId`, `status`,
`createdAt`). Uniqueness (one per Person, unique id) is enforced at the
repository boundary. See ADR-003, ADR-019, `identity-model.md`,
`docs/vertical-slices/create-athlete-profile.md`.

## R4. [S3] AthleteProfile ↔ Sport is many-to-many.

`AthleteSportParticipation` (Athlete context) links one AthleteProfile to many
Sports, and a Sport to many AthleteProfiles. It references the `Sport` by
`Id<"Sport">` only — sport existence is checked through the application-facing
`SportDirectory` query contract, never by importing the Sports Catalog domain.
A single athlete may participate across multiple sports throughout their
lifetime. It is participation only, NOT competition entry, registration, team
membership, or result/ranking history. Leaving a sport is a non-destructive
lifecycle change (`status: "ended"` + `endedAt`); participation is never
deleted. See ADR-019, `sports-model.md`,
`docs/vertical-slices/add-athlete-sport.md`.

## R5. Historical competition records must be auditable and protected from destructive mutation.

`CompetitionResult` entries are append-only. Corrections produce a new entry
with `status: "amended"` referencing the prior entry; the original is never
overwritten or deleted. See `results-achievements-model.md`,
`audit-integrity.md`.

## R6. Achievements/championships are separate from spendable rewards.

`Achievement` (champion, medalist, record holder) is a verifiable historical
record. `RewardsLedgerEntry` (Sports Points) is a spendable accounting entry.
Issuing an achievement does not issue points, and vice versa. See ADR-006.

## R7. Sports Points must use an append-oriented ledger as source of truth.

`RewardsLedgerEntry` is the source of truth. `RewardsBalance` is a **derived
projection**, never authoritative and never mutated directly. See ADR-006.

## R8. QR credentials identify a person but must not contain sensitive profile data.

A `QrCredential` carries only an opaque `payloadToken` that resolves to the
person server-side. It must not embed name, DOB, contact, or health data.
See ADR-007.

## R9. Permanent Sports ID QR and temporary/dynamic event credentials are separate concepts.

`QrCredentialKind` discriminates `permanent_sports_id` (long-lived, person-scoped)
from `event_credential` (short-lived, event-scoped, rotatable). See
`qr-credentials-model.md`. SportsId and QrCredential are separate concepts
[C] — rotating/revoking a credential never changes the Person's SportsId.

## R10. QR identity, biometric/device authentication, and identity verification are separate concepts.

- QR identity = "which person does this credential point to"
- Biometric/device auth = "is this device unlocked by its owner"
- Identity verification = "has this person been verified (self / document / verified)"

These are independent and compose; none implies another. See
`qr-credentials-model.md`.

## R11. Competition architecture must support team, individual, timed, measured, and multi-participant events.

Competitions carry a `format` and a `participantKind` (individual | team). The
`measure` field drives scoring semantics. Formats are extensible without
schema change. See ADR-005, ADR-013, `competition-model.md`.

## R12. Geography must not hard-code Philippine administrative structures.

Geography uses a generic, typed-place model with a country code (ISO 3166-1)
and an ordered list of named administrative levels. No `barangay`/`municipality`
columns. See `geography-localization.md`.

## R13. Currency must not hard-code PHP.

`Money` carries an ISO 4217 `currency` code. Amounts are integer minor units.
See `commerce-model.md`.

## R14. [C] Multi-tenancy and organization isolation must be explicit, but NOT every entity is tenant-owned.

Entities are classified by ownership (see `tenancy.md`, ADR-010):
**platform-global**, **reference data**, **person-owned**,
**organization/tenant-owned**, **event-scoped**, **historical/audit**. Only
organization/tenant-owned and event-scoped entities carry `tenantId`.
Platform-global entities (Person, SportsId, Sport, Discipline) and
person-owned entities (AthleteProfile, AthleteSportParticipation) do NOT carry
`tenantId`. Cross-tenant access to tenant-owned data is never implicit.

## R15. Authorization must be permission-based, not hard-coded role checks.

Authorization evaluates `Permission` values against scopes derived from
memberships/assignments [C]. Code must not branch on role names
(`if role === 'organizer'`). Permissions derive from scoped
`OrganizationMembership`, `TeamMembership`, `EventAssignment`, and
`PlatformRoleAssignment`, not from permanent global person roles. See
`authorization.md`, ADR-012.

## R16. Financial operations must be auditable.

Every charge, refund, settlement, and adjustment produces append-only records
(`PaymentTransaction`, `Refund`, `Settlement`). The financial ledger is
append-only [C]. See `commerce-model.md`, `audit-integrity.md`, ADR-014.

## R17. Reward issuance must support fraud controls and event verification.

`RewardsLedgerEntry` carries `verified` and `verificationRef`. Issuance for an
event result must be verified before the balance projection counts it as
available. Issuance is idempotent [C] — `idempotencyKey`, `sourceIdentity`,
`earningRuleId`/`earningRuleVersion` prevent duplicate awards. Corrected
results use reversal/adjustment entries, never edits to original entries. See
`rewards-model.md`, ADR-015.

## R18. Registration participant and payment payer must be separate concepts.

A `Registration` has a `participantId` (AthleteProfile or Team) and a separate
`payerPersonId`. A guardian may pay for a minor athlete. See
`registration-model.md`, ADR-008.

## R19. [S3] Minors/guardian relationships must be supportable, separately from Person.

Guardian relationships are **not** a field on `Person` — `Person` carries no
`guardianId`. A guardian link is modelled as a separate `GuardianRelationship`
in the Auth context, between two Persons, so the Person aggregate stays focused
on identity. Guardian consent flows attach to that relationship. Date of birth
is private identity data retained only on Person. The architecture explicitly
considers minors in retention/privacy [C]. Guardian workflows are not
implemented this sprint. See `identity-model.md`, `person-role-model.md`,
`audit-integrity.md`, ADR-011.

## R20. [C] Historical sports records must not disappear because an account/entity is deleted — but blanket "soft delete only" is replaced by a layered retention model.

Retention is separated into: account closure, Person deactivation, identity
archival, legal/business retention, anonymization/pseudonymization, historical
competition preservation, and audit/financial retention. Historical
sporting/financial records may be preserved without retaining unnecessary
personal data indefinitely. See `audit-integrity.md`, ADR-011.

## R21. Domain/application logic must be reusable across web and future Android/iOS delivery.

Domain and application layers have zero imports from browser, React, React
Native, Supabase, Stripe, or any platform SDK. See `dependency-rules.md`,
ADR-009.

## R22. Native/platform APIs must remain behind adapters.

Camera, QR scanner, push, secure storage, biometrics, file upload, deep links,
sharing, location, offline sync — all are capability contracts in
`src/app/contracts/platform/native-ports.ts` [S2], implemented by adapters per
platform. These native platform contracts are owned by the application layer,
NOT the domain [C]. See `client-platforms.md`, `mobile-strategy.md`, ADR-016.

## R23. Architecture must allow future limited offline workflows for event operations without implementing them now.

The `OfflineSyncPort` and queued-operation model exist to support future
offline event check-in and scoring. No offline implementation is built this
sprint. See `offline-resilience.md`.

## R24. Infrastructure may later be replaced without rewriting core business logic.

Ports are owned by the application layer [C]. Adapters implement them.
Swapping Supabase for another Postgres provider, or Stripe for another
processor, requires only a new adapter. See `dependency-rules.md`, ADR-016.

## R25. [C] Domain must not depend on native/browser/infrastructure ports.

The domain layer contains business model and invariants only. It must NOT
import any infrastructure or native capability contract. Application owns
orchestration and the required external capability contracts (`Clock`,
`IdGenerator`, `SportsIdGenerator`, `EventPublisher`, repositories, native
platform contracts). See `dependency-rules.md`, ADR-016.

## R26. [C] Cross-context interaction is not limited to EventBus.

Bounded-context domain internals must not directly depend on another context's
repositories or domain internals. Cross-context interaction may use: published
application contracts, synchronous query/service ports, domain/integration
events, and immutable shared identifiers. Synchronous vs asynchronous is
chosen per consistency requirement. **[S2]** Cross-context imports are now
forbidden even when type-only; a genuinely shared concept (e.g.
`CompetitionMeasure`) lives in the shared kernel (`@shared/measurement`). See
`dependency-rules.md`, ADR-017, ADR-018.

## R27. [S1] TeamMembership is team/organization-scoped; event participation is a separate concept.

`TeamMembership` records that a Person belongs to a Team within an Organization
(a tenant isolation boundary). It is **not** event-scoped. Participation in a
specific event is represented by a future `EventRosterEntry` / `CompetitionEntry`
concept (added with a competition vertical slice), which references the event,
the competition/division, and the participant. This keeps standing team
membership independent of per-event rosters. See `person-role-model.md`.

## R28. [S1] `tenantId` denotes an isolation boundary, not a generic association.

A `tenantId` on an entity means that entity lives **inside** a tenant's
isolation boundary and is subject to that tenant's access control. It is not a
convenience foreign key for "an organization is involved." Historical/audit
records may retain origin references (e.g. the organizing `tenantId` a result
was produced under) without becoming mutable tenant-owned records. See
`tenancy.md`, ADR-010.

## R29. [S1] Aggregate-root status is decided by invariants and lifecycle, not by having an ID.

A concept is an aggregate root because it owns a transactional consistency
boundary and an independent lifecycle — not merely because it has an identifier.
Conceptual entities are not automatically aggregate roots; candidate boundaries
are validated through vertical slices, not fixed up front. See ADR-013.

## R30. [S1] Repositories are use-case/context-specific, not a generic CRUD abstraction.

The application layer defines **no** generic `Repository<T>` interface. Each
bounded context / use-case declares the persistence contract it actually needs
when a slice requires it, so aggregates are not forced into identical CRUD
semantics. See `application-foundation.md`, ADR-016, ADR-018.

## Enforcement

- **TypeScript path aliases** keep layers navigable (`@domain`, `@app`,
  `@adapters`, `@composition`, `@shared`).
- **`dependency-cruiser`** [S1] machine-enforces all layer and context-isolation
  rules. Run independently with `npm run architecture:check`; the same ruleset
  is asserted in `tests/architecture.test.ts`. See `dependency-rules.md` and
  ADR-018. Cross-context domain imports fail the check — including type-only
  references [S2].
- **ESLint `import/no-cycle`** is a secondary guard against circular dependencies.
- **Code review** remains a backstop but is no longer the primary boundary
  mechanism.
