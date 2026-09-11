import type { ClaimTokenHash } from "@domain/auth/person-claim";
import type { Brand } from "@shared/kernel";

export type RawClaimToken = Brand<string, "RawClaimToken">;
export interface ClaimTokenGenerator { generate(): RawClaimToken; }
export interface ClaimTokenHasher { hash(token: RawClaimToken): ClaimTokenHash; }
