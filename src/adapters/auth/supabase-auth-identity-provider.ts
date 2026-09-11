import type { AuthIdentityProvider, AuthIdentityResult } from "@app/contracts";
import type { AuthSubject } from "@domain/auth/account";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Validates the bearer/session identity with Supabase; no Supabase type crosses this adapter. */
export class SupabaseAuthIdentityProvider implements AuthIdentityProvider {
  constructor(private readonly client: Pick<SupabaseClient, "auth">) {}

  async getCurrentIdentity(): Promise<AuthIdentityResult> {
    try {
      const { data, error } = await this.client.auth.getUser();
      if (error !== null) return error.status === 401 ? { kind: "unauthenticated" } : { kind: "unavailable" };
      const subject = data.user?.id.trim();
      return subject ? { kind: "authenticated", identity: { subject: subject as AuthSubject } } : { kind: "unauthenticated" };
    } catch {
      return { kind: "unavailable" };
    }
  }
}
