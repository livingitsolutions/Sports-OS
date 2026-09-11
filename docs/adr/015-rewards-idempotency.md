# ADR 015 — Rewards Idempotency and Reversal

## Status

Accepted

## Date

2026-09-08

## Context

Sprint 0's rewards ledger had `issuance`, `redemption`, `adjustment`, and
`expiry` entry kinds. It lacked explicit idempotency controls, source
identity, earning rule versioning, and a distinct `reversal` entry kind.
Without these, duplicate awards can occur (e.g. an event processed twice),
and correcting a voided result by appending a generic `adjustment` does not
clearly distinguish "this undoes a specific issuance" from "this is a manual
correction."

## Decision

Extend the rewards ledger with:

1. **Idempotent issuance** — each issuance carries an `idempotencyKey`
   (deterministic, derived from the source). Submitting the same issuance
   twice produces the same key; the second is rejected as a duplicate.
2. **Source identity** — `RewardSourceIdentity` (`sourceType` + `sourceId`)
   identifies what triggered the issuance (result, achievement, event
   participation, manual). Enables duplicate-award prevention: the same
   source cannot produce two issuances.
3. **Earning rule identity/version** — `earningRuleId` + `earningRuleVersion`
   identify which rule and which version produced the points. Prior issuances
   retain their original version when rules change.
4. **Duplicate-award prevention** — before appending an issuance, the
   application checks whether an entry with the same `idempotencyKey` (or
   the same `sourceIdentity` + `earningRuleId`) already exists. If so, the
   issuance is silently ignored (idempotent success).
5. **`reversal` entry kind** — distinct from `adjustment`. A `reversal` entry
   carries `reversesEntryId` pointing to the specific issuance it undoes.
   Used when a result is voided. Points are the negation of the original.
6. **Corrected results use compensating/reversal entries** — the original
   issuance is never edited. A voided result → `reversal` entry. An amended
   result → new `issuance` entry. The original issuance and its reversal
   remain in the ledger.

Entry kinds: `issuance`, `reversal`, `adjustment`, `redemption`, `expiry`.

See `rewards-model.md`.

## Consequences

**Positive:**
- Duplicate awards are prevented by construction (idempotency key + source
  identity).
- Earning rule versioning provides auditability for rule changes.
- `reversal` clearly distinguishes "undo a specific issuance" from "manual
  adjustment."
- Original ledger entries are never edited — full audit trail preserved.

**Negative:**
- Slightly more fields on each ledger entry.
- Idempotency key generation must be deterministic and collision-free.
- The application must check for existing entries before appending (an extra
  query, mitigated by an index on `idempotencyKey`).

## Alternatives considered

- **Generic `adjustment` for all corrections (Sprint 0).** Rejected: does not
  distinguish reversal from manual correction; no link to the original entry;
  audit trail is ambiguous.
- **No idempotency key (trust the event system).** Rejected: event systems
  may deliver duplicates (at-least-once); the ledger must be self-protecting.
- **Mutable issuance with a `voided` flag.** Rejected: violates append-only
  principle; the original entry would be mutated.

## Compliance

- `RewardsLedgerEntry` carries `idempotencyKey`, `sourceIdentity`,
  `earningRuleId`, `earningRuleVersion`, `reversesEntryId`.
- `reversal` is a distinct `LedgerEntryKind`.
- No code path mutates an existing ledger entry.
- Duplicate issuance requests are detected and silently ignored.
