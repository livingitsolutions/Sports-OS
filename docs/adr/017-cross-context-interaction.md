# ADR 017 — Cross-Context Interaction

## Status

Accepted

## Date

2026-09-08

## Context

Sprint 0 required all cross-context communication to use EventBus (domain
events). This is too restrictive: some interactions require immediate
consistency (e.g. Registration needs to know if an Order is paid before
allowing withdrawal), and forcing all communication through asynchronous
events would make simple read queries unnecessarily complex and would
introduce eventual consistency where immediate consistency is needed.

## Decision

Replace the "EventBus only" rule with a nuanced interaction policy:

**Bounded-context domain internals must not directly depend on another
context's repositories or domain internals.** Cross-context interaction may
use:

1. **Published application contracts** — well-defined interfaces (query/
   service ports) owned by the application layer, allowing one context to
   query another for read-only data when synchronous consistency is needed.
2. **Synchronous query/service ports** — for when the caller needs an
   immediate consistent answer. Example: Registration queries Commerce via
   an `OrderQueryPort` for an Order's payment status.
3. **Domain/integration events** — for asynchronous, eventual-consistency
   communication. Example: Results publishes `ResultConfirmed`; Rewards
   reacts asynchronously to consider issuance.
4. **Immutable shared identifiers** — typed IDs from the shared kernel.
   Contexts reference each other by typed ID, never by importing another
   context's aggregate state.

**Choose synchronous vs asynchronous according to consistency requirements:**

| Requirement | Mechanism | Example |
|---|---|---|
| Immediate consistent answer | Synchronous query port | Registration asks Commerce: "is Order X paid?" |
| Eventual consistency acceptable | Domain event | Results publishes `ResultConfirmed`; Rewards reacts |
| Cross-context reference only | Shared typed ID | Registration stores `Id<"Event">` without loading the Event |
| Read model projection | Integration event | Results publishes events; a projector updates Statistics |

See `dependency-rules.md`, `bounded-contexts.md`.

## Consequences

**Positive:**
- Synchronous reads are possible when needed without violating context
  boundaries.
- Asynchronous events remain the default for decoupled, eventual-consistency
  communication.
- Contexts remain independently testable (synchronous ports are mockable).
- The right consistency model is chosen per interaction, not forced globally.

**Negative:**
- Developers must choose the right mechanism per interaction (more decisions
  than "always use events").
- Synchronous query ports introduce a runtime dependency between contexts
  (mitigated by owning the port interface in the consuming context's
  application layer, with the providing context's adapter implementing it).

## Alternatives considered

- **EventBus only (Sprint 0).** Rejected: cannot handle immediate-consistency
  reads; makes simple queries overly complex; introduces unnecessary
  eventual consistency.
- **Direct repository access across contexts.** Rejected: couples contexts
  to each other's internal data model; breaks context independence.
- **Shared database views for cross-context reads.** Rejected: couples
  contexts at the persistence layer; violates infrastructure independence.

## Compliance

- No context imports another context's domain internals.
- Synchronous query ports are application-owned interfaces.
- Domain events are used for asynchronous communication.
- Shared typed IDs are used for cross-context references.
- Documented examples in `dependency-rules.md`.
