import type { Account, AuthSubject } from "@domain/auth/account";
import type { Id, Result } from "@shared/kernel";

export type AccountPersistenceError =
  | { readonly kind: "duplicate_account_id" }
  | { readonly kind: "auth_subject_already_linked" }
  | { readonly kind: "person_already_linked" }
  | { readonly kind: "person_not_found" }
  | { readonly kind: "invalid_persistence_state"; readonly detail?: string }
  | { readonly kind: "unavailable"; readonly detail?: string };

export type AccountLookupResult =
  | { readonly kind: "found"; readonly account: Account }
  | { readonly kind: "not_found" }
  | { readonly kind: "invalid_persistence_state"; readonly detail?: string }
  | { readonly kind: "unavailable"; readonly detail?: string };

export interface AccountRepository {
  create(account: Account): Promise<Result<Account, AccountPersistenceError>>;
  findByAuthSubject(subject: AuthSubject): Promise<AccountLookupResult>;
  findByPersonId(personId: Id<"Person">): Promise<AccountLookupResult>;
}
