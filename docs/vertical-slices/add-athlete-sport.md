# Vertical slice: Add AthleteSport (multi-sport participation)

Status: implemented in Sprint 3 (architecture version v0.5.0).

This slice links an existing `AthleteProfile` to a `Sport`, establishing the
many-to-many participation model of the **Athlete** bounded context (ADR-019).

## What it does

Adds one `AthleteSportParticipation` between an AthleteProfile and a Sport. A
single profile may participate in many sports at once; a sport may have many
profiles. Adding the same sport twice while already actively participating is
rejected.

## Model facts

- **Many-to-many:** one profile ↔ many sports, one sport ↔ many profiles.
- **References only:** participation holds `athleteProfileId` and `sportId`
  (branded `Id<>`), plus `status`, `startedAt`, `endedAt`. It copies no sport
  catalog data.
- **Participation only:** NOT competition entry, registration, team membership,
  result, ranking, or achievement history.
- **Leaving a sport is non-destructive:** modelled as `status: "ended"` +
  `endedAt`. There is no delete operation; ending a participation is out of
  scope this sprint but the shape supports it. [S4] The store keeps ended rows
  and permits **re-entry** to the same sport with a new active row.
- **Active-conflict check considers only `status: "active"` participations.**

## Layers involved

- **Shared kernel** (`@shared`): `Result`, branded `Id<B>`, `ISODateString`,
  `DomainError`.
- **Domain** (`src/domain/athlete/`):
  - `athlete.types.ts` — `AthleteSportParticipation`, `ParticipationStatus`.
  - `athlete-sport.ts` — `addAthleteSport(input): Result<AddedAthleteSport,
    DomainError>`, a pure factory. It validates non-empty `athleteProfileId` and
    `sportId`, builds an `active` participation (`endedAt: null`) from the
    supplied id/timestamp, and returns the `AthleteSportAdded` event.
  - `athlete.events.ts` — `AthleteSportAdded`, carrying identifiers only.
- **Application** (`src/app/`):
  - `contracts/sport-directory.ts` — minimal read-only `SportDirectory` with
    `exists(sportId)`. Confirms a Sport exists without any Sports Catalog CRUD
    and without importing the Sports domain.
  - `contracts/athlete-profile-repository.ts` — `findById`,
    `findActiveParticipation`, `addParticipation` with typed persistence errors.
  - `use-cases/add-athlete-sport.ts` — `AddAthleteSport implements UseCase`.
- **Adapters** (`src/adapters/`): `InMemorySportDirectory` /
  `InMemoryAthleteProfileRepository` (unit tests) and [S4] `PgSportDirectory` /
  `PgAthleteProfileRepository` (PostgreSQL, the production store).
- **Composition** (`src/composition/`): production and test wiring.

## Use-case flow

1. Validate and normalize input (`athleteProfileId`, `sportId` trimmed,
   non-empty).
2. Confirm the profile exists via `AthleteProfileRepository.findById`.
3. Confirm the sport exists via `SportDirectory.exists`.
4. Confirm no active participation in that sport already, via
   `AthleteProfileRepository.findActiveParticipation`.
5. Generate an `AthleteSportParticipationId`
   (`idGenerator.next("AthleteSportParticipation")`) and read the clock.
6. Build a valid participation via the domain factory.
7. Persist via `AthleteProfileRepository.addParticipation`.
8. **Only after a successful write**, publish `AthleteSportAdded`.
9. Return a typed `Result`.

## Error handling

Expected failures are a typed union and are never thrown: `invalid_input`,
`athlete_profile_not_found`, `sport_not_found`, `already_participating`,
`persistence_unavailable`. The repository is the last line of defence against a
duplicate active participation.

[S4] In production this is enforced by a **partial unique index** on
`(athlete_profile_id, sport_id) WHERE status = 'active'`, which maps to
`already_participating`. Because it constrains only active rows, ended history is
preserved and an athlete may leave and later return to the same sport. A
foreign-key violation on `athlete_profile_id` maps to `athlete_profile_not_found`.

## Events and delivery

The domain returns the event; it never calls a publisher. A failed add publishes
**no** events. The same future outbox concern noted in `create-athlete-profile.md`
applies.

## Out of scope

Ending/leaving a sport, disciplines, competition participation of any kind, and
the Sports Passport read model.

## Tests

- `tests/athlete/athlete.test.ts` — participation factory and invariants.
- `tests/athlete/add-athlete-sport.test.ts` — multiple sports for one profile,
  same sport twice rejected, different athletes may share a sport, sport
  existence validated, profile required, participation-only exact-keys
  assertion.
- [S4] `tests/integration/pg-persistence.test.ts` — one-active-participation-
  per-sport and re-entry after ending, against a real database (guarded on
  `TEST_DATABASE_URL`, skipped when unset).
