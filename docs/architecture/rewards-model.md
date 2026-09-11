# Rewards Model

> Sports Points rewards accounting with an append-only ledger as source of
> truth, idempotent issuance, and reversal/adjustment strategy.
> See ADR-006, ADR-015, R7, R17.

## Ledger is source of truth (R7)

`RewardsLedgerEntry` is the **authoritative** record of Sports Points. A
`RewardsBalance` is a **derived projection** — recomputable from the ledger,
never mutated directly. There is no "update balance" operation; there is only
"append a ledger entry."

```typescript
interface RewardsLedgerEntry {
  id: Id<"RewardsLedgerEntry">;
  tenantId: Id<"Tenant">;
  athleteProfileId: Id<"AthleteProfile">;
  kind: LedgerEntryKind;
  points: number;
  sourceResultId: Id<"Result"> | null;
  sourceIdentity: RewardSourceIdentity | null;
  earningRuleId: string | null;
  earningRuleVersion: number | null;
  idempotencyKey: string | null;
  verified: boolean;
  verificationRef: string | null;
  reversesEntryId: Id<"RewardsLedgerEntry"> | null;
  recordedAt: ISODateString;
}

type LedgerEntryKind = "issuance" | "reversal" | "adjustment" | "redemption" | "expiry";
```

## [C] Idempotent issuance

Sprint 0.1 extends rewards with idempotent earning issuance:

1. **`idempotencyKey`** — a deterministic key derived from the source (e.g.
   `result:{resultId}:rule:{ruleId}`). Submitting the same issuance request
   twice produces the same key; the second is rejected as a duplicate.
2. **`sourceIdentity`** — identifies what triggered the issuance
   (`sourceType` + `sourceId`). This enables duplicate-award prevention: the
   same source cannot produce two issuances.
3. **`earningRuleId` + `earningRuleVersion`** — identifies which earning rule
   and which version of it produced the points. If the rule changes, a new
   version is used; prior issuances retain their original version.
4. **Duplicate-award prevention** — before appending an issuance, the
   application checks whether an entry with the same `idempotencyKey` (or
   the same `sourceIdentity` + `earningRuleId`) already exists. If so, the
   issuance is silently ignored (idempotent success).

## [C] Reversal and adjustment strategy

Sprint 0.1 adds `reversal` as a distinct entry kind (separate from
`adjustment`):

| Entry kind | When used | Sign | Reverses? |
|---|---|---|---|
| `issuance` | Earning points (pending or verified) | positive | no |
| `reversal` | The source result is voided/corrected — undoes a specific issuance | negative | yes (`reversesEntryId`) |
| `adjustment` | Manual correction (e.g. fraud clawback, system error) | ± | may reference original |
| `redemption` | Spending points | negative | no |
| `expiry` | Points expire per policy | negative | no |

**Original ledger entries are never edited.** Corrected results use
compensating/reversal entries:

1. A result is confirmed → `issuance` entry appended (pending, `verified: false`).
2. The result is later voided → `reversal` entry appended
   (`reversesEntryId` → the original issuance, `points` = negation).
3. The result is amended with a new value → a new `issuance` entry for the
   new value. The original issuance and its reversal remain in the ledger.

This preserves the complete audit trail while ensuring the balance projection
reflects only the current valid state.

## Accounting rules

1. **Append-only.** Ledger entries are never modified or deleted. Corrections
   are new entries (`reversal` or `adjustment`).
2. **Integer points.** No fractional points.
3. **Issuance is conditional.** An `issuance` entry is created with
   `verified: false` initially. It becomes `verified: true` after event
   verification/fraud checks. Only verified issuances count toward
   `available` in the balance projection.
4. **Redemption requires available balance.** A `redemption` entry is only
   appended if the athlete's verified available balance covers it.
5. **Balance is a projection.** `available = sum(verified issuance) -
   sum(reversal) - sum(redemption) - sum(adjustment negative) - sum(expiry)`.
   `pending = sum(unverified issuance)`.
6. **Idempotency.** Duplicate issuance requests are detected via
   `idempotencyKey` / `sourceIdentity` and silently ignored.

```mermaid
flowchart LR
  Result["Result confirmed"] -->|issuance (verified=false, idempotencyKey)| Ledger[(Ledger)]
  Verification["Verification / fraud check"] -->|verify| Ledger
  ResultVoided["Result voided"] -->|reversal (reversesEntryId)| Ledger
  ResultAmended["Result amended"] -->|new issuance| Ledger
  Ledger -->|project| Balance["RewardsBalance"]
  Redemption["Redemption"] -->|redemption entry| Ledger
  Expiry["Policy expiry"] -->|expiry entry| Ledger
```

## Fraud controls & event verification (R17)

Issuance is gated:

- A `ResultConfirmed` event triggers a **pending** issuance (with
  `idempotencyKey` to prevent duplicates).
- A verification step (official confirmation, anti-fraud rules, event
  integrity checks) flips `verified` to true.
- Voiding a result appends a `reversal` entry — rewards are clawed back
  without mutating the original issuance.
- `verificationRef` links to the verification record/official.

## Achievements vs Rewards (R6, recap)

Achievements are historical recognition; rewards are spendable points. A
champion gets an `Achievement` (permanent, verifiable) and **may** get a
Sports Points `issuance` (spendable). The two are independent decisions in
independent contexts. See `results-achievements-model.md`.

## Marketplace & redemption (future)

The reward marketplace is a future consumer of the Rewards context. It reads
the derived balance and appends `redemption` entries. It does not own the
ledger. Redemption items, catalogs, and fulfillment are future aggregates in
a Marketplace context, not built this sprint.

## Tenant isolation

Every ledger entry carries `tenantId`. Balance projections are per-athlete
within a tenant. Cross-tenant reward access is never implicit (R14).

## Expiry

Points may expire (e.g. season-bound rewards). Expiry is an `expiry` ledger
entry (negative points) appended at the expiry time. It is not a deletion of
the original issuance. This keeps the ledger complete and auditable.
