# ADR 001 — Modular Domain Architecture

## Status

Accepted

## Date

2026-09-08

## Context

SportsOS is a large, multi-domain sports platform (identity, competition,
commerce, rewards, credentials, …) that must remain infrastructure-independent
and reusable across web and future mobile delivery. A single layered
architecture with no internal boundaries would couple unrelated concerns,
making the system hard to evolve, test, and port. The platform must also allow
infrastructure (persistence, payments, native APIs) to be replaced without
rewriting business logic.

Forces:
- Multiple evolving domains with different rates of change.
- Requirement that core logic never depends on a specific infrastructure
  provider (Supabase, Stripe, browser, native).
- Future Android/iOS distribution without a rewrite.
- Need for auditable, append-only historical records.

## Decision

Adopt **modular domain-driven architecture** with **strict dependency
boundaries** and **ports/adapters**:

1. Decompose the system into **bounded contexts**, each owning its aggregates,
   value objects, and domain events.
2. Layer the code as: **Presentation → Application → Domain**, with a
   **shared kernel** of generic primitives.
3. Define **ports** (interfaces) in the **application layer** [C] for every
   infrastructure or native capability. The domain layer must NOT depend on
   ports (see ADR-016).
4. Implement ports with **adapters** in an isolated package — the only place
   infrastructure SDKs are imported.
5. Cross-context communication uses **domain/integration events**, **synchronous
   query/service ports**, **published application contracts**, and **shared
   typed identifiers** [C] — never direct access to another context's domain
   internals or repositories. See ADR-017.
6. Dependency direction is strictly inward/downward; cycles are forbidden.

See `bounded-contexts.md` and `dependency-rules.md`.

## Consequences

**Positive:**
- Contexts evolve independently; teams can own contexts.
- Infrastructure is swappable per R24; core logic is web/mobile-reusable per
  R21.
- Strict boundaries make auditability and append-only invariants easier to
  enforce.
- High testability: domain/application are pure TypeScript.

**Negative:**
- More upfront structure and indirection (ports + adapters) than a flat app.
- Cross-context features require event coordination or synchronous service
  ports, not direct access to another context's domain internals [C].
- Enforcement discipline is required (lint + review).

**Neutral:**
- Future automated layer enforcement (`dependency-cruier` /
  `eslint-plugin-boundaries`) is a backlog item.

## Alternatives considered

- **Single-layer CRUD app.** Rejected: domains are too many and too
  different; coupling would block evolution and audit requirements.
- **Microservices from day one.** Rejected: premature operational complexity;
  the platform is pre-product. Modular monolith with context boundaries is
  the right granularity now, with the option to split services later along
  context lines.
- **Hexagonal only, no bounded contexts.** Rejected: ports/adapters handle
  infrastructure isolation but not domain coupling; bounded contexts are
  needed for internal clarity.

## Compliance

- TypeScript path aliases (`@domain`, `@app`, `@adapters`, `@shared`). (The
  `@ports` alias was retired in Sprint 2; see ADR-016.)
- ESLint `import/no-cycle`.
- Code review rejects `@domain` imports of application contracts or `@adapters` [C], and
  `@app` imports of `@adapters` or platform SDKs.
- Future: `dependency-cruiser` / `eslint-plugin-boundaries` rules (ADR-018).
