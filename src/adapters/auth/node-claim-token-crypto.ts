import { createHmac, randomBytes } from "node:crypto";
import type { ClaimTokenGenerator, ClaimTokenHasher, RawClaimToken } from "@app/contracts";
import type { ClaimTokenHash } from "@domain/auth/person-claim";

/** Generates 256 bits of entropy. The bearer value is never logged or persisted. */
export class NodeClaimTokenGenerator implements ClaimTokenGenerator {
  generate(): RawClaimToken { return randomBytes(32).toString("base64url") as RawClaimToken; }
}

/** HMAC-SHA-256 adds a server-held pepper to the already high-entropy bearer token. */
export class HmacClaimTokenHasher implements ClaimTokenHasher {
  constructor(private readonly pepper: string) {
    if (pepper.length < 32) throw new Error("Claim token pepper must be at least 32 characters.");
  }
  hash(token: RawClaimToken): ClaimTokenHash {
    return createHmac("sha256", this.pepper).update(token).digest("base64url") as ClaimTokenHash;
  }
}
