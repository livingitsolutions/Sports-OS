# ADR 003 — Multi-Sport Athlete Model

## Status

Accepted

## Date

2026-09-08

## Context

Athletes in SportsOS are multi-sport: a single athlete may participate in and
win across multiple sports throughout their lifetime (product vision; R3, R4).
A naive model would create one "Athlete" per sport (e.g. a BasketballAthlete
and a SwimmingAthlete for the same person), which would fragment identity,
duplicate achievements, and make a unified Sports Passport impossible.

## Decision

Model **at most one `AthleteProfile` per Person**, sport-independent and
**optional** [C]. A Person does not automatically become an athlete; they may
exist only as a coach, guardian, official, organizer, staff member, or sponsor
representative. When an AthleteProfile exists, sport participation is a
separate **many-to-many** relationship (`AthleteSportParticipation`).

```typescript
interface AthleteProfile {
  id: Id<"AthleteProfile">;
  personId: Id<"Person">;
  // no tenantId — person-owned [C]
  // no sport field — sport-independent
}

interface AthleteSportParticipation {
  athleteProfileId: Id<"AthleteProfile">;
  sportId: Id<"Sport">;
  disciplineId: Id<"Discipline"> | null;
  active: boolean;
}
```

The `AthleteProfile` entity carries only `personId`. It is **person-owned**
(not tenant/organization-owned) [C]. All sport-specific data lives on the
participation link. Results, Achievements, and the Rewards ledger reference
the AthleteProfile (not a sport-specific variant), so a person's record across
sports is unified.

See `sports-model.md`, `identity-model.md`, ADR-010.

## Consequences

**Positive:**
- One unified sporting identity per person → a single Sports Passport.
- Achievements and rewards aggregate naturally across sports.
- Adding a new sport is a new participation record, not a new entity.
- Matches the product vision ("multi-sport athlete").

**Negative:**
- Queries for "athletes in sport X" go through the participation link, not a
  direct athlete-by-sport lookup. (Acceptable — indexable.)

## Alternatives considered

- **One Athlete per sport.** Rejected: fragments identity, duplicates the
  person across sports, blocks a unified passport.
- **Sport as a field on Athlete.** Rejected: forces one sport per athlete,
  contradicting the multi-sport requirement.
- **No Athlete entity; use Person + sport tags.** Rejected: the competition/
  results/rewards contexts need a stable, sport-independent sporting identity
  to reference; Person is too broad (includes non-athlete roles).

## Compliance

- `AthleteProfile` type has no sport field and no `tenantId` [C].
- `AthleteSportParticipation` is the only sport linkage.
- Results/Achievements/Rewards reference `Id<"AthleteProfile">` [C].
