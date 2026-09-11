# ADR 006 — Rewards Ledger

## Status

Accepted

## Date

2026-09-08

## Context

Sports Points are a spendable reward currency. They must be auditable, fraud-
resistant, and tied to event verification (R7, R17). They must be **separate**
from achievements/championships (R6), which are historical recognition, not
spendable. A mutable "balance" column would be unauditable and race-prone.

## Decision

1. The **`RewardsLedgerEntry` is the source of truth** for Sports Points. It
   is **append-only**: entries are never modified or deleted.
2. `RewardsBalance` is a **derived projection** of the ledger, recomputable
   from it. It is never mutated directly; there is no "update balance"
   operation.
3. Entry kinds: `issuance` (positive), `reversal` (negative, undoes a
   specific issuance via `reversesEntryId`), `adjustment` (manual correction),
   `redemption` (negative), `expiry` (negative) [C].
4. **Issuance is conditional on verification and idempotent** [C]. An
   issuance starts `verified: false`; it counts toward `pending`, not
   `available`. After event verification/fraud checks, it becomes
   `verified: true`. `idempotencyKey`, `sourceIdentity`, `earningRuleId`, and
   `earningRuleVersion` prevent duplicate awards. Voiding a result appends a
   `reversal` entry (not an `adjustment`) [C].
5. **Achievements and rewards are separate.** Issuing an Achievement does not
   issue points; points issuance is an independent decision in the Rewards
   context (R6).
6. Reversals/clawbacks are new entries (`reversal` kind with
   `reversesEntryId`), never mutations [C]. See ADR-015.

See `rewards-model.md`, `results-achievements-model.md`.

## Consequences

**Positive:**
- Full auditability: any balance is reconstructable by replaying the ledger.
- Fraud control via verified/unverified issuance gating.
- No race on a mutable balance column (reconciliation is arithmetic).
- Clean separation from achievements.

**Negative:**
- Balance queries require aggregating the ledger (mitigated by a cached
  projection that is rebuildable).
- Redemption under concurrency requires a lock/version check in the adapter
  to prevent over-spending.

## Alternatives considered

- **Mutable balance column.** Rejected: unauditable, race-prone, violates R7.
- **Achievements that confer spendable points.** Rejected: violates R6;
  achievements are recognition, not currency.
- **Single ledger for both financial and rewards.** Rejected: different
  domains, different consumers, different verification rules. Keep separate
  append-only ledgers (Payment ledger, Rewards ledger).

## Compliance

- `RewardsLedgerEntry` is append-only by construction.
- `RewardsBalance.available` excludes unverified issuances.
- No code path mutates a ledger entry.
- Achievements and rewards issuance are independent.
- Idempotency key prevents duplicate awards [C].
- `reversal` entry kind used for result voiding [C].
