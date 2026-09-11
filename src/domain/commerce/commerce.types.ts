import type { Id, ISODateString } from "@shared/kernel";
import type { Brand } from "@shared/kernel";

/**
 * Commerce boundary (see ADR-008, ADR-014,
 * docs/architecture/commerce-model.md).
 *
 * Currency is NOT hard-coded. Amounts carry an ISO 4217 code.
 * Financial operations are auditable; ledgers are append-only.
 *
 * Re-evaluated from Sprint 0: Commerce is NOT one Payment aggregate with
 * embedded history. It is a conceptual separation among:
 *   RegistrationCharge/Order → PaymentAttempt → PaymentTransaction
 *   → Refund → Settlement → OrganizerPayout
 */

export type CurrencyCode = Brand<string, "Currency">;

export interface Money {
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
}

/**
 * RegistrationCharge — a charge line item arising from a Registration.
 * Owned by Commerce but references Registration by typed ID.
 */
export interface RegistrationCharge {
  readonly id: Id<"RegistrationCharge">;
  readonly tenantId: Id<"Tenant">;
  readonly registrationId: Id<"Registration">;
  readonly amount: Money;
  readonly description: string;
}

/**
 * Order — a commercial obligation aggregating one or more RegistrationCharges
 * for a payer. The payer is a Person, independent of the competition participant.
 */
export interface Order {
  readonly id: Id<"Order">;
  readonly tenantId: Id<"Tenant">;
  readonly payerPersonId: Id<"Person">;
  readonly chargeIds: ReadonlyArray<Id<"RegistrationCharge">>;
  readonly totalAmount: Money;
  readonly status: OrderStatus;
}

export type OrderStatus = "open" | "partially_paid" | "paid" | "refunded" | "voided";

/**
 * PaymentAttempt — a single attempt to pay an Order. Multiple attempts may
 * exist for one Order (e.g. a failed card retry, then a successful GCash).
 */
export type PaymentAttemptStatus =
  | "initiated"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled";

export interface PaymentAttempt {
  readonly id: Id<"PaymentAttempt">;
  readonly tenantId: Id<"Tenant">;
  readonly orderId: Id<"Order">;
  readonly amount: Money;
  readonly status: PaymentAttemptStatus;
  readonly providerRef: string | null;
  readonly attemptNumber: number;
}

/**
 * PaymentTransaction — the captured/settled money movement from a successful
 * PaymentAttempt. Append-only. This is the immutable financial record.
 */
export interface PaymentTransaction {
  readonly id: Id<"PaymentTransaction">;
  readonly tenantId: Id<"Tenant">;
  readonly attemptId: Id<"PaymentAttempt">;
  readonly orderId: Id<"Order">;
  readonly amount: Money;
  readonly capturedAt: ISODateString;
}

/**
 * Refund — a reversal of a PaymentTransaction. Append-only. May be partial.
 * The original transaction is never mutated.
 */
export interface Refund {
  readonly id: Id<"Refund">;
  readonly tenantId: Id<"Tenant">;
  readonly transactionId: Id<"PaymentTransaction">;
  readonly amount: Money;
  readonly recordedAt: ISODateString;
}

/**
 * Settlement — the platform's reconciliation with a payment provider for a
 * batch of transactions. Append-only. Future workflow.
 */
export interface Settlement {
  readonly id: Id<"Settlement">;
  readonly tenantId: Id<"Tenant">;
  readonly transactionIds: ReadonlyArray<Id<"PaymentTransaction">>;
  readonly totalAmount: Money;
  readonly settledAt: ISODateString;
}

/**
 * OrganizerPayout — the platform's payout to an organizer. Append-only.
 * Future workflow; the shape is defined to support it.
 */
export interface OrganizerPayout {
  readonly id: Id<"OrganizerPayout">;
  readonly tenantId: Id<"Tenant">;
  readonly organizationId: Id<"Organization">;
  readonly settlementIds: ReadonlyArray<Id<"Settlement">>;
  readonly amount: Money;
  readonly paidOutAt: ISODateString;
}
