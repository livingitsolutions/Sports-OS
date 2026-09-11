# ADR 009 — Web-First, Mobile Distribution

## Status

Accepted

## Date

2026-09-08

## Context

SportsOS launches as a responsive web app (React + Vite + TS + Tailwind) but
must later be distributed as Android and iOS apps via Google Play and the App
Store **without rewriting domain or application logic** (R21). Native
capabilities (camera, QR scanner, push, secure storage, biometrics, file
upload, deep links, sharing, location, offline sync) must be accessible
without coupling core logic to a platform (R22).

## Decision

1. **Web-first delivery** now: React + Vite + TypeScript + Tailwind, mobile-
   first responsive.
2. **Domain and application layers are pure TypeScript** with zero platform
   dependencies (no React, React Native, browser, Supabase, Stripe, Node-only
   imports). This is enforced by layer rules.
3. **Native/platform capabilities are application-owned contracts** in
   `src/app/contracts/platform/native-ports.ts` [S2],
   implemented by adapters per platform. The domain/application never import
   an adapter or platform SDK.
4. **Future mobile distribution** via either:
   - **React Native shell** reusing domain/application/ports with RN adapters
     (primary recommendation), or
   - **WebView shell** (Capacitor-style) wrapping the web app with a native
     bridge implementing the same ports.
   Either path leaves core logic unchanged; only adapters and the presentation
   shell differ.
5. No PWA, Android, or iOS implementation is built this sprint. The seam
   exists so these can be added later without core changes.

See `client-platforms.md`, `mobile-strategy.md`, `dependency-rules.md`.

## Consequences

**Positive:**
- Core logic is write-once, run-on-web-and-mobile.
- Platform capabilities are isolated behind adapters (R22).
- Mobile distribution path is open without a rewrite commitment now.
- Infrastructure independence (R24) is preserved.

**Negative:**
- View-layer code may differ between web and React Native (accepted; hooks,
  state, and services are shared).
- Strict import discipline is required to prevent platform leaks into core.

**Neutral:**
- The concrete mobile path (RN vs WebView) can be decided when mobile
  distribution is prioritized; the architecture does not force the choice now.

## Alternatives considered

- **React Native from day one.** Rejected: the product launches web-first;
  starting RN-first inverts the delivery strategy and slows web delivery.
- **Platform-coupled core (use browser APIs directly in domain).** Rejected:
  violates R21/R22 and blocks mobile reuse.
- **PWA-only for mobile.** Rejected: PWAs cannot list on the App Store
  reliably and lack some native capabilities; a native shell is needed for
  store distribution.

## Compliance

- `@domain` and `@app` import no platform SDK (enforced by review + lint).
- `src/app/contracts/platform/native-ports.ts` [S2] defines all native capability contracts.
- `src/adapters/` is the only place platform SDKs may be imported.
- No PWA/native implementation exists this sprint (by design).
