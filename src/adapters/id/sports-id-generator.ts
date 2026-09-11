import type { SportsIdGenerator } from "@app/contracts/sports-id-generator";
import type { Id } from "@shared/kernel";

/**
 * Production Sports ID generator.
 *
 * Public format (version 1): `SID1-XXXXXXXXXXXX` where the body is 12 random
 * Crockford base32 characters drawn from a cryptographically strong source.
 * The value is opaque — it encodes nothing about the person, tenant, sport, or
 * time of issuance. The `SID1` prefix is a FORMAT version, not data: a future
 * `SID2` format can be introduced without touching already-issued IDs.
 *
 * ~60 bits of entropy make accidental collisions vanishingly unlikely, but the
 * use case + repository still verify uniqueness rather than assuming it.
 */
const FORMAT_VERSION = "1";
const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BODY_LENGTH = 12;

export class RandomSportsIdGenerator implements SportsIdGenerator {
  next(): Id<"SportsId"> {
    const bytes = new Uint8Array(BODY_LENGTH);
    crypto.getRandomValues(bytes);
    let body = "";
    for (const byte of bytes) {
      body += CROCKFORD_BASE32.charAt(byte % CROCKFORD_BASE32.length);
    }
    return `SID${FORMAT_VERSION}-${body}` as Id<"SportsId">;
  }
}
