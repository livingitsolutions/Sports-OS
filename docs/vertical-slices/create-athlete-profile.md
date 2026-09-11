# Vertical slice: Create AthleteProfile

Status: implemented in Sprint 3 (architecture version v0.5.0).

This slice creates an optional, sport-independent athletic identity for an
existing Person. It is the first slice in the dedicated **Athlete** bounded
context (ADR-019).

## What it does

Given an existing `Person`, it creates **at most one** `AthleteProfile` for that
Person. Becoming an athlete is optional and explicit: a Person is never
auto-promoted. The profile holds minimal state only — it duplicates no Person
identity data (no name, no date of birth, no Sports ID).

## Model facts

- **Optional:** a Person may never have a profile.
- **At most one per Person:** enforced by the use case and, as last line of
  defence, by the repository.
- **Person-owned, not tenant-owned:** no `tenantId`.
- **Sport-independent:** no `sportId`. Sport linkage is a separate slice
  (`add-athlete-sport.md`).
- **No Person identity duplication:** shape is `{ id, personId, status,
  createdAt }`.
- **Date of birth is private:** never read or copied here.

## Layers involved

- **Shared kernel** (`@shared`): `Result`, branded `Id<B>`, `ISODateString`,
  `DomainError`.
- **Domain** (`src/domain/athlete/`):
  - `athlete.types.ts` — `AthleteProfile`, `AthleteProfileStatus`.
  - `athlete-profile.ts` — `createAthleteProfile(input): Result<CreatedAthleteProfile,
    DomainError>`, a pure factory. It validates a non-empty `personId`, builds an
    `active` profile from the supplied id/timestamp, and returns the
    `AthleteProfileCreated` event. It generates no IDs and reads no clock.
  - `athlete.events.ts` — `AthleteProfileCreated`, carrying identifiers and a
    timestamp only. No name, no date of birth.
- **Application** (`src/app/`):
  - `contracts/athlete-profile-repository.ts` — context-specific
    `AthleteProfileRepository` (no generic CRUD); typed
    `AthleteProfilePersistenceError`.
  - `contracts/person-repository.ts` — `PersonRepository.findById`, reused to
    confirm the Person exists (no cross-context domain import).
  - `use-cases/create-athlete-profile.ts` — `CreateAthleteProfile implements
    UseCase`.
- **Adapters** (`src/adapters/`): `InMemoryAthleteProfileRepository` (unit
  tests) and [S4] `PgAthleteProfileRepository` (PostgreSQL, the production
  store).
- **Composition** (`src/composition/`): production and test wiring.

## Use-case flow

1. Validate and normalize input (`personId` trimmed, non-empty).
2. Confirm the Person exists via `PersonRepository.findById`.
3. Confirm the Person has no existing profile via
   `AthleteProfileRepository.findByPersonId`.
4. Generate an `AthleteProfileId` (`idGenerator.next("AthleteProfile")`) and read
   the clock.
5. Build a valid profile via the domain factory.
6. Persist via `AthleteProfileRepository.create`.
7. **Only after a successful write**, publish `AthleteProfileCreated`.
8. Return a typed `Result`.

## Error handling

Expected failures are a typed union and are never thrown: `invalid_input`,
`person_not_found`, `athlete_profile_already_exists`,
`duplicate_athlete_profile_id`, `persistence_unavailable`. Database-shaped errors
never reach the domain; the repository translates them into typed persistence
outcomes. The repository is the last line of defence for both unique
`AthleteProfileId` and one-profile-per-Person.

[S4] In production this is enforced by database constraints: the
`athlete_profiles` primary key maps to `duplicate_athlete_profile_id` and its
`UNIQUE(person_id)` maps to `person_already_has_profile`, so one-profile-per-
Person holds even under concurrent requests.

## Events and delivery

The domain returns the event; it never calls a publisher. A failed create
publishes **no** events. A future transactional outbox will make
publish-after-commit durable; it is documented here and intentionally **not**
built in this slice.

## Out of scope

Guardian/privacy workflows, the Sports Passport read model, and sport
participation (see `add-athlete-sport.md`). [S4] The profile is now durably
persisted in PostgreSQL.

## Tests

- `tests/athlete/athlete.test.ts` — domain factory and invariants (including a
  no-identity-duplication assertion over exact keys and an event-has-no-personal-
  data assertion).
- `tests/athlete/athlete-profile-repository.test.ts` — in-memory persistence,
  unique id, one-per-Person.
- `tests/athlete/create-athlete-profile.test.ts` — the full use-case flow,
  including the no-events-on-failure guarantee and deterministic ids/time.
