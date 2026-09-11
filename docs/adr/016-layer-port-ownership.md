# ADR 016 — Layer and Port Ownership

## Status

Accepted

## Date

2026-09-08

## Context

Sprint 0 placed `Repository`, `EventBus`, `Clock`, and `IdGenerator` ports in
a location that could be imported by both the domain and application layers,
and the dependency-rules table listed "Domain → Ports" as allowed. This
violates the principle that the domain layer should contain only business
model and invariants, with no dependency on infrastructure or external
capability contracts. Native platform ports were also in the same `src/ports/`
directory, blurring ownership.

## Decision

1. **Domain layer must NOT depend on ports.** The domain contains business
   model, aggregates, value objects, domain events, and invariants only. It
   does not import any infrastructure or native capability contract.
2. **Application layer owns ports.** `Repository`, `EventBus`, `Clock`,
   `IdGenerator`, and all native capability ports (`CameraPort`,
   `QrScannerPort`, etc.) are owned by the application layer. They live in
   `src/app/contracts/` (see Sprint 2 update) and are application-owned.
3. **Domain produces events; application handles delivery.** Aggregates
   produce `DomainEvent` values. The application layer's `EventBus` port
   routes them to interested contexts. The domain does not call `eventBus.
   publish()` — it returns events, and the application layer publishes them.
4. **Domain receives IDs and timestamps as values.** The domain does not
   call `IdGenerator` or `Clock`. The application layer generates IDs and
   timestamps and passes them to domain operations.
5. **Adapters implement ports.** `src/adapters/` is the only place
   infrastructure SDKs and platform APIs are imported. Adapters depend on
   ports (and domain types for persistence) but never the reverse.

Port ownership table:

| Port | Owner | Domain may import? |
|---|---|---|
| `Repository<T,B>` | Application | No |
| `EventBus` | Application | No |
| `Clock` | Application | No |
| `IdGenerator` | Application | No |
| `CameraPort`, `QrScannerPort`, etc. | Application | No |

See `dependency-rules.md`.

## Sprint 2 update

The separate `src/ports/` directory was removed. Native platform capability
contracts (`CameraPort`, `QrScannerPort`, etc.) now live under
`src/app/contracts/platform/native-ports.ts` — still application-owned, just
co-located with the other application contracts. The `@ports` path alias and the
`domain-no-ports` enforcement rule were retired; `domain-no-app` already covers
the domain not importing them. The underlying decision is unchanged: the domain
never depends on capability contracts, the application owns them, and adapters
implement them.

## Consequences

**Positive:**
- Domain is pure business logic — maximally testable and portable.
- No infrastructure leakage into the domain.
- Clear ownership: application owns external capability contracts.
- Domain can be reused on web and mobile without any port changes.

**Negative:**
- Application services must mediate between domain and ports (generate IDs,
  timestamps, publish events) — slightly more orchestration code.
- Domain aggregates return events rather than publishing them, which is a
  discipline developers must follow.

## Alternatives considered

- **Domain may import ports (Sprint 0).** Rejected: couples domain to
  infrastructure contracts; makes domain less portable and testable; blurs
  the boundary between "what the business rules are" and "how the system
  interacts with the outside world."
- **Ports in a separate package imported by both.** Rejected: same coupling
  problem; the domain still depends on external capability contracts.

## Compliance

- `src/domain/` files import no capability contract (enforced by `domain-no-app`).
- Native capability contracts live under `src/app/contracts/platform/` [S2], application-owned.
- Domain aggregates return `DomainEvent` values; application publishes them.
- `src/domain/aggregate.ts` `DomainEvent` comment says "application routes
  them" (corrected from "routed through an application-layer port").
- `dependency-cruiser` rejects any `@domain` import of an application contract.
