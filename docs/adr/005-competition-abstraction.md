# ADR 005 — Competition Abstraction

## Status

Accepted

## Date

2026-09-08

## Context

SportsOS must support tournaments, leagues, and standalone events; team and
individual competitions; timed, measured, scored, judged, and multi-participant
formats (R11). The competition model must be extensible to new formats without
schema changes or code branches in other contexts.

## Decision

1. **CompetitionEvent** (renamed from EventContainer) is the top-level
   organized occurrence (kind: `tournament` | `league` | `standalone`),
   organized by an Organization [C].
2. **Competition** is an independent aggregate (not a child entity of
   CompetitionEvent) that carries [C]:
   - `eventId` — reference to parent CompetitionEvent by typed ID.
   - `format` (extensible enum).
   - `participantKind` (`individual` | `team`).
   - `measure` (from the Discipline).
3. **Division / Category** is an independent aggregate referencing Competition
   by ID [C].
4. **Stage** is an independent aggregate referencing Division by ID [C].
5. **Contest** (future) is an independent aggregate referencing Stage by ID,
   discriminated by ContestKind (match/heat/bout/race) [C].
6. The **participant abstraction** is a discriminated union: `participantId`
   is `Id<"AthleteProfile">` or `Id<"Team">` depending on `participantKind` [C].
7. **Format is data, not a code branch in other contexts.**
8. **Scoring/results belong to a separate context** (Results & Achievements),
   not Competition.

See `competition-model.md`, `results-achievements-model.md`, ADR-013.

## Consequences

**Positive:**
- One model handles team, individual, timed, measured, judged, and
  multi-participant events.
- New formats are non-breaking additions.
- A tournament can contain both individual and team events.
- Results immutability is independent of bracket mutations.

**Negative:**
- The bracket/draw structure per format is modeled via Stage/Contest
  aggregates (future) [C] — each level is an independent lifecycle to avoid
  unbounded aggregates at national scale.
- Participant type discrimination must be enforced where `participantId` is
  consumed.

## Alternatives considered

- **Separate models per format.** Rejected: explodes the schema and forces
  every consumer (registration, results) to special-case formats.
- **Competition owns results.** Rejected: coupling structure and outcomes
  would make results mutable alongside bracket changes, violating R5.
- **Team and individual as separate hierarchies.** Rejected: the participant
  abstraction unifies them cleanly.

## Compliance

- `Competition.format`, `.participantKind`, `.measure` are required [C].
- `CompetitionEvent`, `Competition`, `Division`, `Stage`, `Contest` are
  independent aggregates referencing parents by typed ID [C].
- Results context records outcomes without branching on format.
- New formats are added to the `EventFormat` union without other changes.
