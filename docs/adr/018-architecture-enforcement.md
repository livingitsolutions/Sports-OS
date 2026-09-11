# ADR 018 — Architecture Enforcement

## Status

Accepted — **implemented in Sprint 1**.

## Date

2026-09-08 (implemented 2026-09-08, Sprint 1)

## Context

Sprint 0 relied on code review and ESLint `import/no-cycle` for boundary
enforcement. This is insufficient: the critical rules (domain must not import
ports, no cross-context domain internal imports, application must not import
adapters) are not machine-enforced. Human review is error-prone and does not
scale. A CI gate that automatically rejects boundary violations is needed.

## Decision

Add machine-enforced boundary rules using `dependency-cruiser` (or
`eslint-plugin-boundaries` as an alternative) in Sprint 1:

1. **Layer rules:**
   - `@domain` may only import from `@shared` and other `@domain` files.
   - `@app` may import from `@domain`, `@shared`.
   - `@adapters` may import from `@app` (contracts), `@domain`, `@shared`, platform SDKs.
   - `@domain` must NOT import from `@app` (ADR-016) [S2].
   - `@domain` and `@app` must NOT import from `@adapters`.
   - No layer may import platform SDKs except `@adapters`.

2. **Context isolation rules:**
   - A `@domain/<context>/` file must NOT import from another
     `@domain/<other-context>/` directory.
   - Cross-context interaction is via application-layer contracts (ports,
     events, shared IDs), not direct domain imports.

3. **CI gate:**
   - `dependency-cruiser` runs as part of `npm run lint` or a separate
     `npm run arch-check` script.
   - Boundary violations fail the CI build.

4. **Enforcement documentation:**
   - A `docs/architecture/enforcement.md` document (to be created in Sprint 1)
     describes the rules, the tool configuration, and how to resolve
     violations.

**Implemented in Sprint 1.** This ADR documented the decision and planned
rules; the section below records what was actually built.

## Sprint 1 implementation

`dependency-cruiser` (v18) was adopted. Configuration lives in
`.dependency-cruiser.cjs`; it resolves aliases from `tsconfig.app.json` and sets
`tsPreCompilationDeps: true` so rules can distinguish `import type` (type-only,
erased at build) from runtime imports.

Run independently with `npm run architecture:check` (scans `src` only). The same
ruleset is exercised programmatically in `tests/architecture.test.ts`, which
also proves the checker flags a forbidden import fixture
(`tests/fixtures/forbidden-domain/`, outside `src`).

Enforced `error`-severity rules: `no-circular`; `domain-no-app`,
`domain-no-adapters`, `domain-no-composition`, `domain-no-presentation`,
`domain-no-external-sdk`; `no-cross-context`; `app-no-adapters`,
`app-no-composition`, `app-no-presentation`, `app-no-external-sdk`;
`presentation-no-adapters`; `adapters-no-presentation-or-composition`.
(`domain-no-ports` was retired in Sprint 2 when the ports layer was removed.)

**Type-only cross-context decision (Sprint 1, superseded by Sprint 2):** Sprint 1
permitted `import type` across contexts, keeping the single case (Competition
referencing the Sports `CompetitionMeasure` vocabulary) legal. Sprint 2 reversed
this — see "Sprint 2 update" below.

## Sprint 2 update

Two enforcement changes were made:

1. **Ports layer removed.** Native capability contracts moved to
   `src/app/contracts/platform/`; the `domain-no-ports` rule and `@ports` alias
   were retired (ADR-016).
2. **Cross-context isolation tightened to include type-only imports.** The rule
   was renamed `no-cross-context` and no longer exempts `import type`: a bounded
   context may not reach into another context's source files at all, even for a
   type. The one shared vocabulary, `CompetitionMeasure`, moved to
   `@shared/measurement`, which both Sports and Competition import. Rationale:
   even a type-only import couples the two contexts' source layouts and invites
   accidental runtime coupling later; a genuinely shared concept belongs in the
   shared kernel or a published contract. `tests/architecture.test.ts` includes
   a fixture proving a type-only cross-context import is now flagged.

## Consequences

**Positive:**
- Boundary violations are caught automatically, not just by review.
- New developers get immediate feedback on architecture violations.
- The architecture is self-documenting through the rule definitions.

**Negative:**
- Tool configuration requires upfront effort in Sprint 1.
- Some legitimate edge cases (e.g. shared domain types across contexts) may
  require rule exceptions that must be documented.

## Alternatives considered

- **Code review only (Sprint 0).** Rejected: does not scale; error-prone;
  violations slip through.
- **TypeScript project references for isolation.** Rejected: project
  references manage build order, not import restrictions; they cannot enforce
  "domain must not import ports."
- **Custom ESLint rules.** Rejected: high maintenance cost; dependency-cruiser
  and eslint-plugin-boundaries already solve this problem.

## Compliance

- `dependency-cruiser` configuration added at `.dependency-cruiser.cjs`.
- `npm run architecture:check` script added to `package.json`; runnable
  independently of build/lint/test.
- `tests/architecture.test.ts` asserts the real tree has zero error-severity
  violations and that a forbidden-import fixture is flagged.
- CI pipeline should include `architecture:check` as a required gate.
