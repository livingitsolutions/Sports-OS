import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { PgAccountRepository } from "@adapters/persistence/pg/pg-account-repository";
import type { Sql } from "@adapters/persistence/pg/connection";
import type { Account, AuthSubject } from "@domain/auth/account";
import type { AggregateVersion } from "@domain/aggregate";
import type { Id, ISODateString } from "@shared/kernel";

const URL = process.env.TEST_DATABASE_URL ?? "";
const RUN = URL.trim().length > 0;
const PREFIX = `account_it_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const NOW = "2026-09-11T00:00:00.000Z" as ISODateString;
const key = (suffix: string) => `${PREFIX}_${suffix}`;
function account(id: string, subject: string, person: string): Account { return { id: key(id) as Id<"Account">, authSubject: key(subject) as AuthSubject, personId: key(person) as Id<"Person">, status: "active", version: 1 as AggregateVersion, createdAt: NOW, updatedAt: NOW }; }

describe.skipIf(!RUN)("PostgreSQL Account persistence", () => {
  let sql: Sql; let repository: PgAccountRepository;
  beforeAll(async () => {
    sql = postgres(URL, { max: 2, ssl: "require", onnotice: () => {} }) as Sql; repository = new PgAccountRepository(sql);
    await sql`INSERT INTO persons (id, display_name, lifecycle_status, version, updated_at) VALUES (${key("p1")}, 'Account One', 'active', 1, ${NOW}), (${key("p2")}, 'Account Two', 'active', 1, ${NOW})`;
  });
  afterAll(async () => { await sql`DELETE FROM accounts WHERE id LIKE ${`${PREFIX}_%`}`; await sql`DELETE FROM persons WHERE id LIKE ${`${PREFIX}_%`}`; await sql.end({ timeout: 5 }); });

  it("persists and rehydrates Account", async () => {
    expect((await repository.create(account("a1", "s1", "p1"))).ok).toBe(true);
    const loaded = await repository.findByAuthSubject(key("s1") as AuthSubject);
    expect(loaded).toMatchObject({ kind: "found", account: { id: key("a1"), status: "active", version: 1, personId: key("p1") } });
  });
  it("enforces unique auth_subject", async () => { expect(await repository.create(account("a2", "s1", "p2"))).toMatchObject({ ok: false, error: { kind: "auth_subject_already_linked" } }); });
  it("enforces unique person_id", async () => { expect(await repository.create(account("a3", "s3", "p1"))).toMatchObject({ ok: false, error: { kind: "person_already_linked" } }); });
  it("enforces Person foreign key", async () => { expect(await repository.create(account("a4", "s4", "missing"))).toMatchObject({ ok: false, error: { kind: "person_not_found" } }); });
  it("enforces positive version", async () => { await expect(sql`INSERT INTO accounts (id, auth_subject, person_id, status, version, created_at, updated_at) VALUES (${key("bad")}, ${key("bad-subject")}, ${key("p2")}, 'active', 0, ${NOW}, ${NOW})`).rejects.toMatchObject({ code: "23514" }); });
});
