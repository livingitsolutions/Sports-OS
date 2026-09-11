# Vertical slice: Create Person + issue permanent Sports ID

Status: implemented in Sprint 2 (architecture version v0.4.0).

This is the first real business vertical slice. It walks a single request from
input through the layers to a persisted, event-producing outcome, and is the
reference example for how every future slice should be shaped.

## What it does

Creating a Person issues **exactly one** permanent Sports ID in the same logical
operation. The Person record holds minimal identity only; the Sports ID is a
platform-global, stable, opaque identifier that is never reused and never
replaced through normal mutation.

## Layers involved

- **Shared kernel** (`@shared`): `Result`, branded `Id<B>`, `ISODateString`,
  `DomainError`.
- **Domain** (`src/domain/identity/`):
  - `person.ts` — `createPerson(input): Result<CreatedPerson, DomainError>` is a
    pure factory. It validates identity (trimmed display name, non-empty, ≤200
    chars; optional valid past calendar date of birth; non-empty Sports ID
    value), builds an active Person, and produces both domain events.
    `renamePerson` demonstrates a normal mutation that preserves the Sports ID.
    [S3] Person carries no `guardianId`; guardian relationships live in the Auth
    context, and date of birth is private identity data.
  - `sports-id.ts` — `issueSportsId(value, issuedAt)` value object.
  - `identity.events.ts` — `PersonCreated` and `SportsIdIssued`. Both are
    emitted, both carry only identifiers/timestamps, neither carries personal
    data.
- **Application** (`src/app/`):
  - `contracts/sports-id-generator.ts` — `SportsIdGenerator` (opaque,
    collision-resistant, no sequential DB ids, no sensitive data, versionable
    format), owned separately from `IdGenerator`.
  - `contracts/person-repository.ts` — context-specific `PersonRepository` with
    only `create` and `findBySportsId`; typed `PersonPersistenceError`
    (`duplicate_person_id` | `duplicate_sports_id` | `unavailable`).
  - `use-cases/create-person.ts` — `CreatePerson implements UseCase`.
- **Adapters** (`src/adapters/`): `RandomSportsIdGenerator` (production),
  `FakeSportsIdGenerator` (deterministic), `InMemoryPersonRepository`, and
  [S4] `PgPersonRepository` (PostgreSQL, the production store).
- **Composition** (`src/composition/`): production and test wiring.

## Use-case flow

1. Validate and normalize input.
2. Generate a Person ID.
3. Obtain a globally-unique Sports ID via bounded retry (`maxSportsIdAttempts`,
   default 5) against `PersonRepository.findBySportsId`; exhaustion returns a
   typed `sports_id_collision`.
4. Build a valid Person via the domain factory.
5. Persist via `PersonRepository.create`.
6. **Only after a successful write**, publish `PersonCreated` and
   `SportsIdIssued`.
7. Return a typed `Result`.

## Error handling

Expected failures are a typed union — `invalid_input`, `sports_id_collision`,
`duplicate_person_id`, `persistence_unavailable`. There is no name-based
duplicate detection. Database-shaped errors never leak into the domain; the
repository translates them into typed persistence outcomes. The repository is
the last line of defence for Sports ID uniqueness, returning
`duplicate_sports_id`.

[S4] In production the Person and its Sports ID are written in **one PostgreSQL
transaction** (`PgPersonRepository.create`), so neither can exist without the
other. Database constraints are the final uniqueness guard behind the use case's
retry: the `sports_ids` primary key and its `UNIQUE(person_id)` map to
`duplicate_sports_id`, and the `persons` primary key maps to
`duplicate_person_id`. No SQLSTATE or driver detail escapes the adapter.

## Events and delivery

The domain returns events; it never calls a publisher. A failed create publishes
**no** events (asserted by tests). A future outbox will make publish-after-commit
durable; it is documented here as a known concern and intentionally **not**
implemented in this slice.

## Tests

- `tests/identity/person.test.ts` — domain factory and invariants.
- `tests/identity/person-repository.test.ts` — in-memory persistence semantics
  and uniqueness.
- `tests/identity/create-person.test.ts` — the full use-case flow, including the
  no-events-on-failure guarantee.
- [S4] `tests/integration/pg-persistence.test.ts` — the atomic Person + Sports ID
  transaction and duplicate-ID / duplicate-Sports-ID conflicts against a real
  database (guarded on `TEST_DATABASE_URL`, skipped when unset).
