# ADR 004 — Organization and Tenancy

## Status

Accepted

## Date

2026-09-08

## Context

SportsOS must support clubs, schools, associations, LGUs, governing bodies,
sponsors, and venue operators, with explicit multi-tenancy and organization
isolation (R14). It must distinguish a legal/structural body (Organization)
from a competing unit (Team). It must not hard-code Philippine administrative
structures (R12) and must scale to multi-country expansion.

## Decision

1. **Tenant** is the isolation boundary for **organization/tenant-owned and
   event-scoped entities** [C]. Not every entity is tenant-owned — see the
   ownership classification in ADR-010. Platform-global (Person, SportsId),
   reference data (Sport, Discipline), and person-owned (AthleteProfile)
   entities do NOT carry `tenantId`. Repositories for tenant-owned entities
   filter by `tenantId` by default. Cross-tenant access is never implicit (R14).
2. **Organization** is a structured body discriminated by `kind` (club,
   school, association, lgu, governing_body, sponsor, venue_operator).
   Organizations can form hierarchies (`parentId`) within a tenant.
3. **Team** is a competing unit that belongs to an Organization and is bound
   to one Sport. An Organization fields many Teams; a Team is not an
   Organization.
4. Geography on organizations uses a generic `TypedPlace` (ISO 3166-1 country
   + ordered admin levels), not PH-specific columns (R12).
5. A Tenant may map to a country/region for expansion; the model is currency-
   and geography-agnostic.

See `organization-model.md`, `tenancy.md`, `geography-localization.md`.

## Consequences

**Positive:**
- Clean separation of legal bodies vs competing units.
- Explicit, enforceable tenant isolation.
- New organization kinds and new countries are data, not schema changes.
- Sponsors/venues fit the same membership/tenancy model.

**Negative:**
- Tenant scoping must be enforced consistently across all repositories and
  queries — discipline required.
- Organization hierarchy validation (no cycles) is a future concern.

## Alternatives considered

- **Team and Organization as one entity.** Rejected: a club fields many teams
  across sports; conflating them loses the sport-binding of teams and the
  legal-body nature of organizations.
- **Single-tenant with "organization" field for isolation.** Rejected: does
  not satisfy R14 explicit multi-tenancy and cross-tenant protection.
- **Hard-coded PH admin columns.** Rejected: violates R12 and blocks
  multi-country expansion.

## Compliance

- All **tenant-owned and event-scoped** entities carry `tenantId` [C].
  Platform-global and person-owned entities do not.
- `Team.organizationId` and `Team.sportId` are required.
- `Organization.parentId` is optional (hierarchy).
- Geography uses `TypedPlace` (future field), never PH-specific columns.
- Ownership classifications documented in `tenancy.md`, ADR-010 [C].
