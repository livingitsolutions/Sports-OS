import { describe, expect, it } from "vitest";
import { HmacClaimTokenHasher, NodeClaimTokenGenerator } from "@adapters/auth/node-claim-token-crypto";
describe("claim token crypto",()=>{it("generates unpredictable 256-bit bearer tokens and HMAC hashes",()=>{const generator=new NodeClaimTokenGenerator();const a=generator.generate();const b=generator.generate();expect(a).not.toBe(b);expect(a.length).toBeGreaterThanOrEqual(43);const hasher=new HmacClaimTokenHasher("a-server-pepper-with-at-least-32-characters");expect(hasher.hash(a)).not.toBe(a);expect(hasher.hash(a)).toBe(hasher.hash(a));});});
