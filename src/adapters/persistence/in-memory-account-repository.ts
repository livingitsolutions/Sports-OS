import type { AccountLookupResult, AccountPersistenceError, AccountRepository } from "@app/contracts";
import type { Account, AuthSubject } from "@domain/auth/account";
import type { Id, Result } from "@shared/kernel";

export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts = new Map<string, Account>();
  failCreates = false;

  async create(account: Account): Promise<Result<Account, AccountPersistenceError>> {
    if (this.failCreates) return { ok: false, error: { kind: "unavailable" } };
    if (account.version !== 1) return { ok: false, error: { kind: "invalid_persistence_state" } };
    if (this.accounts.has(account.id)) return { ok: false, error: { kind: "duplicate_account_id" } };
    if ([...this.accounts.values()].some((value) => value.authSubject === account.authSubject)) return { ok: false, error: { kind: "auth_subject_already_linked" } };
    if ([...this.accounts.values()].some((value) => value.personId === account.personId)) return { ok: false, error: { kind: "person_already_linked" } };
    this.accounts.set(account.id, account);
    return { ok: true, value: account };
  }

  async findByAuthSubject(subject: AuthSubject): Promise<AccountLookupResult> {
    return found([...this.accounts.values()].find((value) => value.authSubject === subject));
  }
  async findByPersonId(personId: Id<"Person">): Promise<AccountLookupResult> {
    return found([...this.accounts.values()].find((value) => value.personId === personId));
  }
}

function found(account: Account | undefined): AccountLookupResult {
  return account === undefined ? { kind: "not_found" } : { kind: "found", account };
}
