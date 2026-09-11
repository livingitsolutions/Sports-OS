# ADR 014 — Commerce Concept Separation

## Status

Accepted

## Date

2026-09-08

## Context

Sprint 0 modeled commerce as a single `Payment` aggregate with embedded
`PaymentLedgerEntry` history. This is insufficient: multiple payment attempts
may occur for one order (e.g. a failed card retry, then a successful GCash
payment); refunds and settlements have independent lifecycles from the
original payment; organizer payouts are a separate concern from payment
processing. A single Payment aggregate conflates these concepts and cannot
model multiple attempts cleanly.

## Decision

Separate commerce into distinct concepts, each with its own lifecycle:

1. **RegistrationCharge** — a charge line item arising from a Registration.
2. **Order** — a commercial obligation aggregating charges for a payer.
   Status transitions: open → partially_paid → paid → refunded → voided.
3. **PaymentAttempt** — a single attempt to pay an Order. Multiple attempts
   per Order are supported. Status: initiated → authorized → captured, or
   → failed, or → cancelled.
4. **PaymentTransaction** — the captured money movement from a successful
   PaymentAttempt. Immutable/append-only.
5. **Refund** — a reversal of a PaymentTransaction. Append-only. May be
   partial. The original transaction is never mutated.
6. **Settlement** — the platform's reconciliation with a payment provider
   for a batch of transactions. Append-only. Future workflow.
7. **OrganizerPayout** — the platform's payout to an organizer. Append-only.
   Future workflow.

The `Order`'s current status is a **projection** of its PaymentAttempts,
PaymentTransactions, and Refunds. The payer (`payerPersonId` on the Order)
remains independent of the competition participant (R18).

See `commerce-model.md`.

## Consequences

**Positive:**
- Multiple payment attempts per Order are first-class.
- Refunds, settlements, and payouts have independent lifecycles.
- Clear auditability: immutable PaymentTransaction + append-only Refund/
  Settlement/OrganizerPayout.
- Payment providers are swappable (the PaymentAttempt interacts with the
  provider; the domain model is provider-agnostic).

**Negative:**
- More concepts to model (7 vs 2).
- Order status projection logic must aggregate across attempts/transactions/
  refunds.
- Idempotency for payment attempts requires care (a retry must not create a
  duplicate transaction).

## Alternatives considered

- **Single Payment + PaymentLedgerEntry (Sprint 0).** Rejected: cannot model
  multiple attempts for one obligation; conflates payment processing with
  refund/settlement/payout.
- **Order + single Payment (no attempts).** Rejected: a failed payment leaves
  no record of the attempt; retries are invisible.
- **Separate microservice per commerce concept.** Rejected: premature; these
  concepts are cohesive within the Commerce bounded context.

## Compliance

- `RegistrationCharge`, `Order`, `PaymentAttempt`, `PaymentTransaction`,
  `Refund`, `Settlement`, `OrganizerPayout` are separate interfaces.
- `PaymentTransaction`, `Refund`, `Settlement`, `OrganizerPayout` are
  append-only.
- Multiple `PaymentAttempt`s per `Order` are supported (`attemptNumber`).
- `Order.payerPersonId` is independent of `Registration.participantId`.
