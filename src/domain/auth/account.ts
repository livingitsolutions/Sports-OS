import { INITIAL_AGGREGATE_VERSION } from "@domain/aggregate";
import type { AggregateVersion } from "@domain/aggregate";
import type { DomainError, Id, ISODateString, Result } from "@shared/kernel";

export type AuthSubject = Id<"AuthSubject">;
export type AccountStatus = "active" | "disabled";

export interface Account {
  readonly id: Id<"Account">;
  readonly authSubject: AuthSubject;
  readonly personId: Id<"Person">;
  readonly status: AccountStatus;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly version: AggregateVersion;
}

export interface NewAccountInput {
  readonly id: Id<"Account">;
  readonly authSubject: AuthSubject;
  readonly personId: Id<"Person">;
  readonly now: ISODateString;
}

/** Creates only the platform account link; it never creates or owns a Person. */
export function createAccount(input: NewAccountInput): Result<Account, DomainError> {
  if (input.authSubject.trim().length === 0) {
    return { ok: false, error: { code: "invalid_auth_subject", message: "Authentication subject is required." } };
  }
  if (input.personId.trim().length === 0) {
    return { ok: false, error: { code: "invalid_person_id", message: "Person identifier is required." } };
  }
  return {
    ok: true,
    value: {
      id: input.id,
      authSubject: input.authSubject,
      personId: input.personId,
      status: "active",
      createdAt: input.now,
      updatedAt: input.now,
      version: INITIAL_AGGREGATE_VERSION,
    },
  };
}
