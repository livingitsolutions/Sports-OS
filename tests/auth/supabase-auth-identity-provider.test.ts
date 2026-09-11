import { describe, expect, it } from "vitest";
import { SupabaseAuthIdentityProvider } from "@adapters/auth/supabase-auth-identity-provider";

describe("SupabaseAuthIdentityProvider boundary", () => {
  it("returns only the provider-neutral subject", async () => {
    const provider = new SupabaseAuthIdentityProvider({ auth: { getUser: async () => ({ data: { user: { id: "subject-1", email: "private@example.test" } }, error: null }) } } as never);
    expect(await provider.getCurrentIdentity()).toEqual({ kind: "authenticated", identity: { subject: "subject-1" } });
  });
  it("does not trust an absent current user", async () => {
    const provider = new SupabaseAuthIdentityProvider({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never);
    expect(await provider.getCurrentIdentity()).toEqual({ kind: "unauthenticated" });
  });
});
