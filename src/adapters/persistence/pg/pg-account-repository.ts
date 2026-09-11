import type { AccountLookupResult, AccountPersistenceError, AccountRepository } from "@app/contracts";
import type { Sql } from "@adapters/persistence/pg/connection";
import { neutralDetail, pgErrorInfo } from "@adapters/persistence/pg/errors";
import type { Account, AccountStatus, AuthSubject } from "@domain/auth/account";
import type { AggregateVersion } from "@domain/aggregate";
import type { Id, ISODateString, Result } from "@shared/kernel";

interface AccountRow { id: string; auth_subject: string; person_id: string; status: string; created_at: Date | string; updated_at: Date | string; version: number; }

export class PgAccountRepository implements AccountRepository {
  constructor(private readonly sql: Sql) {}

  async create(account: Account): Promise<Result<Account, AccountPersistenceError>> {
    if (account.version !== 1) return invalid("A new Account must be version 1.");
    try {
      await this.sql`INSERT INTO accounts (id, auth_subject, person_id, status, version, created_at, updated_at)
        VALUES (${account.id}, ${account.authSubject}, ${account.personId}, ${account.status}, ${account.version}, ${account.createdAt}, ${account.updatedAt})`;
      return { ok: true, value: account };
    } catch (error) {
      const info = pgErrorInfo(error);
      if (info?.code === "23503") return { ok: false, error: { kind: "person_not_found" } };
      if (info?.code === "23505") {
        if (info.constraint.includes("auth_subject")) return { ok: false, error: { kind: "auth_subject_already_linked" } };
        if (info.constraint.includes("person_id")) return { ok: false, error: { kind: "person_already_linked" } };
        return { ok: false, error: { kind: "duplicate_account_id" } };
      }
      return { ok: false, error: { kind: "unavailable", detail: neutralDetail(error) } };
    }
  }

  findByAuthSubject(subject: AuthSubject): Promise<AccountLookupResult> {
    return this.read(() => this.sql<AccountRow[]>`SELECT id, auth_subject, person_id, status, version, created_at, updated_at FROM accounts WHERE auth_subject = ${subject} LIMIT 1`);
  }
  findByPersonId(personId: Id<"Person">): Promise<AccountLookupResult> {
    return this.read(() => this.sql<AccountRow[]>`SELECT id, auth_subject, person_id, status, version, created_at, updated_at FROM accounts WHERE person_id = ${personId} LIMIT 1`);
  }
  private async read(run: () => Promise<AccountRow[]>): Promise<AccountLookupResult> {
    try {
      const row = (await run())[0];
      if (row === undefined) return { kind: "not_found" };
      const account = toAccount(row);
      return account === null ? { kind: "invalid_persistence_state" } : { kind: "found", account };
    } catch (error) { return { kind: "unavailable", detail: neutralDetail(error) }; }
  }
}

function toAccount(row: AccountRow): Account | null {
  if ((row.status !== "active" && row.status !== "disabled") || !Number.isInteger(row.version) || row.version < 1) return null;
  return { id: row.id as Id<"Account">, authSubject: row.auth_subject as AuthSubject, personId: row.person_id as Id<"Person">, status: row.status as AccountStatus, version: row.version as AggregateVersion, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function iso(value: Date | string): ISODateString { return (value instanceof Date ? value.toISOString() : new Date(value).toISOString()) as ISODateString; }
function invalid(detail: string): Result<never, AccountPersistenceError> { return { ok: false, error: { kind: "invalid_persistence_state", detail } }; }
