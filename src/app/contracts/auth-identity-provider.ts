import type { AuthSubject } from "@domain/auth/account";

export interface AuthIdentity {
  readonly subject: AuthSubject;
}

export type AuthIdentityResult =
  | { readonly kind: "authenticated"; readonly identity: AuthIdentity }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "unavailable"; readonly detail?: string };

/** Provider-neutral boundary for a server-validated current identity. */
export interface AuthIdentityProvider {
  getCurrentIdentity(): Promise<AuthIdentityResult>;
}
