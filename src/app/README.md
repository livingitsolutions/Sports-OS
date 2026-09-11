# Application Layer

The application layer orchestrates use-cases and owns the capability contracts
the domain needs but must not implement. It depends only on the domain and on
approved shared-kernel primitives. It must never import concrete adapters,
composition wiring, presentation components, or any platform SDK.

## Structure

- `contracts/` — application-owned interfaces: `UseCase`, application `Result`
  error shape, `Clock`, `IdGenerator`, and event publishing (`EventPublisher`,
  `DomainEvent` re-export, `IntegrationEvent`).
- `use-cases/` — one input/output orchestration per operation. Added per
  bounded context with real vertical slices, not preemptively.
- `services/` — application services that coordinate several use-cases or
  encapsulate cross-cutting orchestration. Added when a real need appears.

## Deliberately absent

There is **no** generic `Repository<T>` abstraction. Repository contracts are
defined per bounded context / use-case when a slice needs persistence, so each
aggregate keeps the query and mutation shape it actually requires instead of a
forced uniform CRUD surface. See ADR-016 and ADR-018.
