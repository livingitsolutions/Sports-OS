import { describe, expect, it } from "vitest";
import { createAccount } from "@domain/auth/account";
import type { AuthSubject } from "@domain/auth/account";
import type { Id, ISODateString } from "@shared/kernel";

describe("Account", () => {
  it("creates active at version 1 without Person or sports data", () => {
    const result = createAccount({ id: "account-1" as Id<"Account">, authSubject: "subject-1" as AuthSubject, personId: "person-1" as Id<"Person">, now: "2026-09-11T00:00:00.000Z" as ISODateString });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({ status: "active", version: 1, personId: "person-1", authSubject: "subject-1" });
    expect(result.value).not.toHaveProperty("sportsId");
    expect(result.value).not.toHaveProperty("athleteProfile");
  });
});
