# ADR 010 — Ownership Classification

## Status

Accepted

## Date

2026-09-08

## Context

Sprint 0 assumed every entity carries `tenantId` and is tenant-owned. This is
incorrect: Person and SportsId are platform-level identities that must not
belong to the first organization/event in which a person participates. Sport
and Discipline are platform reference data. AthleteProfile is person-owned.
Conflating these with tenant-owned data would make a person's identity
non-portable across tenants and would couple reference data to specific
deployments.

## Decision

Define six explicit ownership classifications:

1. **Platform-global** — platform-level identity and configuration. No
   `tenantId`. Examples: `Person`, `SportsId`, `PlatformRoleAssignment`.
2. **Reference data** — canonical catalog data shared across all tenants. No
   `tenantId`. Examples: `Sport`, `Discipline`. A future controlled
   customization model may allow tenant-specific extensions.
3. **Person-owned** — created by/for a Person, belonging to that person across
   contexts. No `tenantId`. Examples: `AthleteProfile`, `IdentityVerification`,
   `QrCredential` (permanent), `GuardianRelationship`.
4. **Organization/tenant-owned** — belongs to an Organization within a Tenant.
   Carries `tenantId`. Examples: `Organization`, `Team`,
   `OrganizationMembership`, `OrganizationRoleAssignment`, `Order`,
   `PaymentAttempt`.
5. **Event-scoped** — tied to a specific event/competition within a tenant.
   Carries `tenantId`. Examples: `CompetitionEvent`, `Competition`, `Division`,
   `Stage`, `Contest`, `Registration`, `EventAssignment`, `TeamMembership`,
   `QrCredential` (event).
6. **Historical/audit** — immutable historical records. Carries `tenantId`
   (origin tenant) for query scoping but retention is governed by audit policy.
   Examples: `CompetitionResult`, `Achievement`, `PaymentTransaction`,
   `Refund`, `Settlement`, `RewardsLedgerEntry`.

See `tenancy.md` for the full classification matrix.

## Consequences

**Positive:**
- Person/SportsId identity is portable across tenants.
- Reference data is consistent across tenants.
- AthleteProfile belongs to the Person, not to an organization.
- Clear rules for which entities need `tenantId` and tenant filtering.

**Negative:**
- Application services must be aware of which entities are tenant-scoped vs
  global vs person-owned — not a blanket "always filter by tenant."
- Cross-context queries that join global and tenant-owned data must handle
  the ownership boundary explicitly.

## Alternatives considered

- **Every entity carries `tenantId`.** Rejected: Person identity becomes
  non-portable; reference data is duplicated per tenant; a person joining
  organizations in different tenants would need duplicate Person records.
- **Tenant field on Person, nullable.** Rejected: nullable tenant on Person
  is ambiguous and invites bugs; the classification should be explicit, not
  optional.

## Compliance

- `Person`, `SportsId`, `AthleteProfile` have no `tenantId` field.
- `Sport`, `Discipline` have no `tenantId` field.
- `Organization`, `Team`, `Registration`, `CompetitionEvent`, etc. carry
  `tenantId`.
- `CompetitionResult`, `RewardsLedgerEntry` carry `tenantId` for scoping.
- Classification matrix documented in `tenancy.md` and `bounded-contexts.md`.
