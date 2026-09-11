# Application Foundation

> Sprint 1 introduced the minimal application-layer foundation and deterministic
> platform implementations that future vertical slices are built on. Sprint 2
> added the first real vertical slice (Create Person + issue Sports ID) on top of
> it. See ADR-002, ADR-016, ADR-018, and `dependency-rules.md`.

## Application contracts (`src/app/contracts/`)

| Contract | Purpose |
|---|---|
| `UseCase<Input, Output>` | Every operation is a use-case returning `Promise<AppResult<Output>>`. |
| `AppError` / `AppResult<T>` | Application error shape (reuses the shared `Result` carrier and error shape). |
| `Clock` | Supplies the current time as an `ISODateString`; the domain never reads the wall clock. |
| `IdGenerator` | Supplies branded identifiers; the domain never generates IDs. |
| `EventPublisher<E>` | Emits events; specialized as `DomainEventPublisher` and `IntegrationEventPublisher`. |
| `SportsIdGenerator` [S2] | Mints the opaque public value of a permanent Sports ID; stricter than `IdGenerator` (no sequential/DB ids, encodes no sensitive data). |
| `PersonRepository` [S2] | Context-specific persistence for the identity slice: `create` (enforces Person ID + Sports ID uniqueness) and `findBySportsId`. |

Platform capability contracts (`CameraPort`, `QrScannerPort`, ...) live under
`src/app/contracts/platform/` [S2] — application-owned, implemented by future
web/native adapters, not implemented yet.

There is deliberately **no generic `Repository<T>`**. Persistence contracts are
defined per bounded context / use-case when a slice needs them, so an aggregate
keeps the exact query and mutation surface it requires instead of a forced,
uniform CRUD interface (clarification 4).

## DomainEvent vs IntegrationEvent

Two distinct concepts, deliberately separated:

- **`DomainEvent`** (`src/domain/aggregate.ts`) — a completed fact **inside a
  single bounded context**, expressed in that context's language. It is not a
  transport concern and may evolve freely as the context evolves.
- **`IntegrationEvent`** (`src/app/contracts/events.ts`) — a versioned,
  self-describing message intended for delivery **outside** the originating
  context. It carries `eventType`, `source`, `version`, and an opaque
  `payload`.

The application layer translates selected domain events into integration
events. External consumers depend only on the integration contract, so internal
domain events can change without breaking them. No production message broker is
built this sprint; an `EventPublisher` with an in-memory implementation is
sufficient for wiring and future use-case tests.

## Deterministic and production implementations (`src/adapters/`)

These live outside the domain and implement application contracts:

| Contract | Production | Deterministic (tests) |
|---|---|---|
| `Clock` | `SystemClock` (wall clock) | `FakeClock` (fixed start, `advance`/`set`) |
| `IdGenerator` | `UuidIdGenerator` (`crypto.randomUUID`) | `FakeIdGenerator` (per-brand sequential, e.g. `test-Person-1`) |
| `SportsIdGenerator` [S2] | `RandomSportsIdGenerator` (versioned `SID1-...`, crypto random) | `FakeSportsIdGenerator` (sequential `SID-TEST-1`; `enqueue` forces collisions) |
| `PersonRepository` [S2] | `InMemoryPersonRepository` (temporary until a durable adapter) | `InMemoryPersonRepository` |
| `EventPublisher` | `NoopEventPublisher` (until a broker adapter) | `InMemoryEventPublisher` / `NoopEventPublisher` |

## Composition root (`src/composition/`)

- `container.ts` — `AppContainer`: the capability set every future use-case is
  constructed against (contracts only, no infrastructure types).
- `production.ts` — `createProductionContainer()` wires the production adapters.
  It does **not** connect a database, initialize authentication, or build any
  product use-case.
- `test.ts` — `createTestContainer()` wires the deterministic adapters and
  exposes their concrete types so tests can advance the clock or assert on
  recorded events.

Presentation obtains a wired container from the composition root; it never
imports adapters directly for business operations.

The container now also exposes wired use cases (`useCases.createPerson`) [S2], so
presentation and tests invoke a fully-assembled use case rather than constructing
it themselves. Production wiring marks the in-memory repository as temporary.

## Create Person vertical slice [S2]

The first business capability: creating a Person issues exactly one permanent
Sports ID in the same logical operation.

- **Domain** (`src/domain/identity/`): `createPerson` factory validates identity
  data, issues the `SportsId` value object (`sports-id.ts`), sets the initial
  `active` lifecycle, and returns the Person together with two domain events —
  `PersonCreated` and `SportsIdIssued` (`identity.events.ts`). Events carry only
  identifiers and issuance facts, never name or date of birth. `renamePerson`
  shows a normal mutation that preserves the Sports ID (it is never replaceable).
- **Use case** (`src/app/use-cases/create-person.ts`): normalize input → generate
  a Person ID → obtain a globally-unique Sports ID via bounded retry against the
  repository → read the clock → build the Person → persist → publish events only
  after a durable create. Expected failures are typed: `invalid_input`,
  `sports_id_collision`, `duplicate_person_id`, `persistence_unavailable`.
- **Persistence results**: adapter/database outcomes are expressed as
  `PersonPersistenceError` (`duplicate_person_id`, `duplicate_sports_id`,
  `unavailable`) in the application layer; the domain never sees infrastructure
  errors.
- **Event/transaction note**: a failed create publishes nothing. Guaranteeing
  that persistence and publication cannot diverge (an outbox) is a future
  concern and is intentionally not implemented.
