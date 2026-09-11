# Mobile Strategy

> How SportsOS reaches Android and iOS without rewriting core logic.
> See ADR-009, R21, R22, `client-platforms.md`.

## Goal

Distribute SportsOS as downloadable apps on Google Play and the Apple App
Store **without rewriting domain or application logic.** Core layers are
platform-independent by construction (R21); native capabilities are behind
adapters (R22).

## Recommended path: React Native shell (primary)

A **React Native** shell that:

- Imports the pure TypeScript `src/domain/` and `src/app/` layers unchanged.
- Imports the `src/app/contracts/platform/` interfaces unchanged.
- Provides **React Native adapters** implementing the native capability ports
  (camera, QR scanner, push, secure storage, biometrics, file upload, deep
  links, share, location, offline sync).
- Reuses much of the application-layer orchestration; only the view layer is
  React Native instead of React DOM.

Benefits:
- Maximum code reuse across web and mobile.
- Single language (TypeScript).
- Direct access to native APIs via community libraries or custom native
  modules behind adapters.

Trade-offs:
- Some view code is written twice (React DOM vs React Native components),
  though hooks, state, and application services are shared.

## Alternative path: WebView shell (fallback)

A **Capacitor-style** native shell that:

- Wraps the web app in a native WebView.
- Exposes a JavaScript bridge implementing the native capability ports.
- Reuses 100% of the web UI.

Benefits:
- Zero view-layer rewrite.
- Fastest path to app stores.

Trade-offs:
- Native feel is limited (WebView performance, gesture fidelity).
- Some native capabilities require bridge work.

The architecture supports **both** paths. The decision can be deferred to when
mobile distribution is prioritized. Either way, the domain/application layers
and port interfaces are identical.

## Native capabilities via adapters (R22)

Every native capability is a port (see `client-platforms.md`). The mobile
shell provides adapters:

| Capability | Mobile adapter source |
|---|---|
| Camera | React Native camera library / native module |
| QR scanner | native QR scanner module |
| Push notifications | FCM (Android), APNs (iOS) |
| Secure credential storage | Android Keystore / iOS Keychain |
| Biometrics | Biometric prompt / Face ID / Touch ID |
| File/photo upload | native picker |
| Deep links | app deep link configuration |
| Sharing | native share sheet |
| Location | native location services |
| Offline sync | native background sync / work manager |

The domain never knows which adapter is active. This is the core of R21/R22.

## Distribution considerations (future)

- Google Play and Apple App Store require a native binary (React Native
  produces one; a WebView shell via Capacitor produces one). The web app
  alone is not a store-listed app.
- App Store / Play policies (sign-in, data collection, permissions) are
  handled at the shell layer, not the domain.
- Store listings, screenshots, metadata are out of scope for this sprint.

## What is explicitly NOT built this sprint

- No React Native project.
- No Capacitor config.
- No native modules.
- No app store listings.
- No PWA service worker.

The architecture merely guarantees that when mobile distribution is
prioritized, the core is ready and only adapters + shell are needed.
