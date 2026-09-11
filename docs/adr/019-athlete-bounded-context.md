# ADR 019 — Distinct Athlete Bounded Context

## Status

Accepted — **implemented in Sprint 3**.

## Date

2026-09-08 (Sprint 3)

## Context

Before Sprint 3, the documentation placed `AthleteProfile` inside the **Identity
& Sports ID** context, while a stale code sketch placed `AthleteProfile` and
`AthleteSportParticipation` inside the **Sports Catalog** context. Neither
placement was right:

- Identity's responsibility is the permanent, platform-issued personal identity
  (`Person`, `SportsId`) that survives account lifecycle changes. An athletic
  identity is optional, has its own lifecycle (a Person may become an athlete
  later, or never), and links to sports — concerns Identity should not carry.
- Sports Catalog owns reference data (`Sport`, `Discipline`). Making it also own
  athletes would couple slow-changing catalog data to per-person athletic state
  and pull person/sport relationship logic into the catalog.

`AthleteProfile` also sits at the intersection of two other contexts: it
references a `Person` (Identity) and, through `AthleteSportParticipation`, one or
more `Sport`s (Sports Catalog). The Sprint 3 brief explicitly invited an
evaluation of whether AthleteProfile deserves its own context before moving any
code.

The architecture already forbids cross-context domain imports outright —
`no-cross-context` (ADR-018, tightened in Sprint 2) rejects even type-only
imports between `src/domain/<context>/` directories. So wherever AthleteProfile
lives, it must reference Person and Sport by shared identifier only.

## Decision

Introduce a dedicated **Athlete** bounded context at `src/domain/athlete/`,
owning `AthleteProfile` and `AthleteSportParticipation`.

1. **Boundary.** The Athlete context references `Person` by `Id<"Person">` and
   `Sport` by `Id<"Sport">` only. It imports no other context's domain
   internals. Person existence is confirmed through the existing
   application-layer `PersonRepository` (extended with `findById`); Sport
   existence is confirmed through a new minimal, read-only `SportDirectory`
   query contract — never by importing the Sports Catalog domain and never by
   adding catalog CRUD.

2. **AthleteProfile shape.** `{ id, personId, status, createdAt }`. It is
   optional (a Person does not auto-become an athlete), at most one per Person,
   person-owned (no `tenantId`), and sport-independent (no `sportId`). It
   duplicates no Person identity data — no name, no date of birth, no Sports ID.

3. **AthleteSportParticipation shape.**
   `{ id, athleteProfileId, sportId, status, startedAt, endedAt }`. It is the
   many-to-many link between an AthleteProfile and Sports. It is participation
   only — NOT competition entry, registration, team membership, result, ranking,
   or achievement history. Leaving a sport is a non-destructive lifecycle change
   (`status: "ended"` + `endedAt`); there is no delete operation.

4. **Repository contract.** `AthleteProfileRepository` is context-specific (no
   generic CRUD). It enforces, as the last line of defence, a unique
   `AthleteProfileId`, at most one profile per Person, and no duplicate active
   participation in the same sport. The in-memory implementation models those
   future uniqueness constraints today.

5. **Domain events.** `AthleteProfileCreated` and `AthleteSportAdded` carry
   identifiers and timestamps only — no names, no date of birth, no unnecessary
   identity data. They are published only **after** a successful repository
   write; failure paths publish nothing. No broker/outbox is built this sprint;
   a transactional outbox is the documented future step.

6. **Private identity data.** Date of birth stays on `Person` and is never
   copied into AthleteProfile, its events, or the future Sports Passport.

7. **Guardian relationships.** Removed from `Person` (no `guardianId`). They
   remain a separate `GuardianRelationship` concept in the Auth context. This is
   a clarification, not a new guardian workflow.

## Consequences

**Positive:**
- Identity stays focused on personal identity; Sports Catalog stays focused on
  reference data. Each context changes for one reason.
- The Athlete context can evolve its lifecycle and participation model without
  touching Identity or Sports.
- Cross-context coupling is limited to shared branded IDs and two application
  contracts, satisfying `no-cross-context` with zero violations.

**Negative:**
- One more context to navigate. Some readers expect athletes "inside" Identity.
- Confirming Person and Sport existence now requires application-layer queries
  rather than a direct object reference — an intentional trade for isolation.

## Alternatives considered

- **Keep AthleteProfile in Identity.** Rejected: conflates optional athletic
  identity and its sport links with permanent personal identity; Identity would
  grow sport-relationship logic it should not own.
- **Put AthleteProfile in Sports Catalog.** Rejected: couples per-person
  athletic state to slow-changing reference data and drags person/sport
  relationship logic into the catalog.
- **A shared "athlete + sport" mega-aggregate / Sports Passport aggregate.**
  Rejected: the Sports Passport is a read model composed across many contexts at
  read time, not a stored aggregate and not part of AthleteProfile.

## Compliance

- New context lives at `src/domain/athlete/` (`athlete.types.ts`,
  `athlete.events.ts`, `athlete-profile.ts`, `athlete-sport.ts`).
- `no-cross-context` passes: the context references Person and Sport by
  `Id<>` only; `npm run architecture:check` reports zero violations.
- Application contracts: `AthleteProfileRepository`, `SportDirectory`, and
  `PersonRepository.findById`. Adapters: `InMemoryAthleteProfileRepository`,
  `InMemorySportDirectory` (both temporary, in-memory).
- Vertical slices documented in
  `docs/vertical-slices/create-athlete-profile.md` and
  `docs/vertical-slices/add-athlete-sport.md`.
- Recorded in `architecture-version.md` (v0.5.0) and reflected in
  `architecture-rules.md` (R3, R4, R14, R19), `identity-model.md`,
  `sports-model.md`, and `bounded-contexts.md`.
