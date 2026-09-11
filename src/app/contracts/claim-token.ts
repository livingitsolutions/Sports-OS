import type { ClaimHashKeyVersion, ClaimLookupId, ClaimTokenHash } from "@domain/auth/person-claim";
import type { Brand } from "@shared/kernel";

export type RawClaimToken = Brand<string, "RawClaimToken">;
export type RawClaimSecret = Brand<string, "RawClaimSecret">;
export interface ClaimTokenParts { readonly version: ClaimHashKeyVersion; readonly lookupId: ClaimLookupId; readonly secret: RawClaimSecret; }
export interface ClaimTokenGenerator { generate(version: ClaimHashKeyVersion): ClaimTokenParts & { readonly credential: RawClaimToken }; parse(token: RawClaimToken): ClaimTokenParts | null; }
export type ClaimHashResult = { readonly ok: true; readonly hash: ClaimTokenHash } | { readonly ok: false; readonly error: "hash_key_unavailable" };
export type ClaimVerifyResult = { readonly ok: true; readonly matches: boolean } | { readonly ok: false; readonly error: "hash_key_unavailable" };
export interface ClaimHashKeyProvider { activeVersion(): ClaimHashKeyVersion; hash(version: ClaimHashKeyVersion, lookupId: ClaimLookupId, secret: RawClaimSecret): ClaimHashResult; verify(version: ClaimHashKeyVersion, lookupId: ClaimLookupId, secret: RawClaimSecret, expected: ClaimTokenHash): ClaimVerifyResult; }
