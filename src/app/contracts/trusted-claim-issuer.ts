import type { ClaimIssuer } from "@domain/auth/person-claim";

declare const trustedIssuer: unique symbol;
/** Constructed only by a trusted adapter/composition boundary, never from request input. */
export type TrustedClaimIssuer = ClaimIssuer & { readonly [trustedIssuer]: true };
export type ClaimIssuancePrincipalResult = {readonly kind:"trusted";readonly issuer:TrustedClaimIssuer}|{readonly kind:"missing"|"untrusted"};
export interface ClaimIssuancePrincipalProvider { current(): ClaimIssuancePrincipalResult; }
