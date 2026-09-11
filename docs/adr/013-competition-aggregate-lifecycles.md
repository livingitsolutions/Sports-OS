# ADR 013 — Competition Aggregate Lifecycles

## Status

Accepted

## Date

2026-09-08

## Context

Sprint 0 modeled `EventContainer` containing `CompetitionEvent` children as a
single aggregate. At national scale (e.g. Palarong Pambansa), an event contains
many sports, divisions, competitions, matches/heats/bouts/races, and thousands
of participants. An aggregate containing all of these would be unbounded,
causing performance and concurrency problems: loading the aggregate would be
expensive, and any mutation would lock the entire event structure.

## Decision

Replace the parent-child aggregate with **independent aggregate lifecycles**
at each level, referencing parents by typed ID:

1. **CompetitionEvent** (aggregate root) — the top-level organized occurrence
   (tournament/league/standalone). Organized by an Organization.
2. **Competition** (independent aggregate) — a specific sport/discipline
   competition within an Event. References `eventId` by ID. Carries format,
   participant kind, and measure.
3. **Division / Category** (independent aggregate) — an age group, weight
   class, or skill level within a Competition. References `competitionId` by ID.
4. **Stage** (independent aggregate) — a phase within a Division (preliminary,
   semifinal, final, etc.). References `divisionId` by ID.
5. **Contest** (future aggregate) — a single match/heat/bout/race within a
   Stage. References `stageId` by ID. Discriminated by `ContestKind`.

Each aggregate has its own repository, its own concurrency boundary, and its
own lifecycle. A mutation to a Stage does not load or lock the parent
CompetitionEvent. Parent references are by typed ID, not by object embedding.

See `competition-model.md`.

## Consequences

**Positive:**
- No unbounded aggregates — each aggregate is bounded to its level.
- Concurrent operations on different competitions/divisions/stages without
  lock contention.
- Each level can be loaded, modified, and persisted independently.
- Scales to national-level events with thousands of participants.

**Negative:**
- Parent-child consistency is not enforced by aggregate boundaries — it must
  be enforced by the application layer (e.g. a Division cannot exist without
  a valid Competition ID).
- Cross-level queries (e.g. "all stages in this event") require joining
  across aggregates.

## Alternatives considered

- **Single EventContainer aggregate with children (Sprint 0).** Rejected:
  unbounded at national scale; performance and concurrency problems.
- **Nested aggregates with lazy loading.** Rejected: still conceptually one
  aggregate; concurrency boundaries are unclear; lazy loading is an
  implementation detail, not an architectural fix.
- **Denormalized flat structure (no hierarchy).** Rejected: loses the
  organizational structure needed for bracket/draw management.

## Compliance

- `CompetitionEvent`, `Competition`, `Division`, `Stage`, `Contest` are
  separate interfaces, each with their own `Id` brand.
- Each references its parent by typed ID, not by embedding.
- No aggregate contains child entities from another level.
