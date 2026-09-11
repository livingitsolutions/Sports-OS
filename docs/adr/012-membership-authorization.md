# ADR 012 — Membership-Based Authorization

## Status

Accepted

## Date

2026-09-08

## Context

Sprint 0 modeled authorization as a single `PersonRole` aggregate binding a
Person to a `RoleKind` within a `RoleScope`. This is insufficient: roles
derive from different kinds of relationships (organization membership, team
membership, event assignment, platform admin, guardianship) with different
lifecycles, different concurrency characteristics, and different scopes.
A flat PersonRole aggregate conflates these, creating awkward add/remove
semantics and imprecise permission derivation. The requirement is
permission-based authorization (R15) with no hard-coded role checks.

## Decision

Replace the `PersonRole` aggregate with separate, scoped concepts:

1. **`PlatformRoleAssignment`** — platform-level admin/support capabilities.
   Platform-global scope.
2. **`OrganizationMembership`** — a Person belongs to an Organization. Tenant-
   owned.
3. **`OrganizationRoleAssignment`** — a Person holds a role (organizer,
   official, coach, team_manager, staff, sponsor_representative) within an
   org membership. Derives org-scoped permissions.
4. **`TeamMembership`** — a Person/AthleteProfile is on a Team. Derives team-
   scoped permissions.
5. **`EventAssignment`** — a Person is assigned to an Event in a capacity
   (official, scorer, marshal, timekeeper, judge). Derives event-scoped
   permissions.
6. **`GuardianRelationship`** — a Person is guardian of a minor Person.
   Derives person-scoped permissions.
7. **`Permission`** — a scoped capability string, namespaced by context.
8. **`PermissionScope`** — the scope at which a permission is evaluated
   (platform, organization, team, event, person).

Permissions are **derived** from memberships/assignments at evaluation time,
not stored as a flat list on the Person. The `AuthorizationService`
(application-owned) evaluates `can(person, permission, scope)` by loading
relevant memberships/assignments and consulting a permission catalog.

See `person-role-model.md`, `authorization.md`.

## Consequences

**Positive:**
- Different lifecycles (org membership vs event assignment) are independent
  aggregates with independent concurrency.
- Permissions are precisely scoped — an `EventAssignment` as `official` grants
  event-scoped permissions only for that event, not globally.
- Adding a new role/capacity is a new assignment type, not a change to a
  central role enum.
- No hard-coded role checks — permission catalog drives all authorization.

**Negative:**
- More aggregates to manage (6 vs 1).
- Permission evaluation requires loading multiple membership/assignment
  records — more queries (mitigated by caching/projection).

## Alternatives considered

- **Single `PersonRole` aggregate (Sprint 0).** Rejected: conflates different
  relationship types; imprecise scoping; awkward lifecycle management.
- **Role-based access control (RBAC) with hard-coded role checks.** Rejected:
  violates R15; inflexible; cannot express nuanced scoping.
- **Attribute-based access control (ABAC) with a rules engine.** Rejected:
  over-engineered for this stage; memberships/assignments provide the
  necessary granularity without a full ABAC engine.

## Compliance

- No `PersonRole` aggregate; replaced by 6 separate aggregates.
- `AuthorizationService.can(person, permission, scope)` evaluates
  memberships/assignments.
- No code branches on role names (`if role === 'organizer'`).
- Permission catalog maps memberships/assignments to permissions.
