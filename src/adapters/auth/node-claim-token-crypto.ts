import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ClaimHashKeyProvider, ClaimHashResult, ClaimTokenGenerator, ClaimTokenParts, RawClaimSecret, RawClaimToken } from "@app/contracts";
import type { ClaimHashKeyVersion, ClaimLookupId, ClaimTokenHash } from "@domain/auth/person-claim";

const VERSION = /^[a-z][a-z0-9_-]{0,31}$/;
const PART = /^[A-Za-z0-9_-]+$/;

/** Generates 256 bits of entropy. The bearer value is never logged or persisted. */
export class NodeClaimTokenGenerator implements ClaimTokenGenerator {
  generate(version: ClaimHashKeyVersion): ClaimTokenParts & { credential: RawClaimToken } { const lookupId=randomBytes(32).toString("base64url") as ClaimLookupId; const secret=randomBytes(32).toString("base64url") as RawClaimSecret; return {version,lookupId,secret,credential:`${version}.${lookupId}.${secret}` as RawClaimToken}; }
  parse(token: RawClaimToken): ClaimTokenParts | null { const [version,lookupId,secret,...rest]=token.split("."); if(rest.length>0||version===undefined||lookupId===undefined||secret===undefined||!VERSION.test(version)||lookupId.length!==43||secret.length!==43||!PART.test(lookupId)||!PART.test(secret)) return null; return {version:version as ClaimHashKeyVersion,lookupId:lookupId as ClaimLookupId,secret:secret as RawClaimSecret}; }
}

export interface ClaimHashKeyConfig { readonly activeVersion:string; readonly keys:readonly {readonly version:string;readonly secret:string}[]; }
export class VersionedHmacClaimHashKeyProvider implements ClaimHashKeyProvider {
  private readonly active:ClaimHashKeyVersion; private readonly keys=new Map<string,string>();
  constructor(config:ClaimHashKeyConfig){if(!VERSION.test(config.activeVersion))throw new Error("Claim hash key configuration has an invalid active version.");for(const entry of config.keys){if(!VERSION.test(entry.version))throw new Error("Claim hash key configuration contains a malformed version.");if(this.keys.has(entry.version))throw new Error("Claim hash key configuration contains a duplicate version.");if(entry.secret.length<32)throw new Error("Claim hash key configuration contains an invalid secret.");this.keys.set(entry.version,entry.secret);}if(!this.keys.has(config.activeVersion))throw new Error("Claim hash key configuration does not contain the active version.");this.active=config.activeVersion as ClaimHashKeyVersion;}
  activeVersion(){return this.active;}
  hash(version:ClaimHashKeyVersion,lookupId:ClaimLookupId,secret:RawClaimSecret):ClaimHashResult{const key=this.keys.get(version);if(key===undefined)return{ok:false,error:"hash_key_unavailable"};return{ok:true,hash:createHmac("sha256",key).update(`${version}.${lookupId}.${secret}`).digest("base64url") as ClaimTokenHash};}
  verify(version:ClaimHashKeyVersion,lookupId:ClaimLookupId,secret:RawClaimSecret,expected:ClaimTokenHash){const result=this.hash(version,lookupId,secret);if(!result.ok)return result;const bytes=(value:string)=>Uint8Array.from(value,char=>char.charCodeAt(0)),a=bytes(result.hash),b=bytes(expected);return{ok:true as const,matches:a.length===b.length&&timingSafeEqual(a,b)};}
}
export function readClaimHashKeyConfig(env:Record<string,string|undefined>):ClaimHashKeyConfig{const activeVersion=env.CLAIM_HASH_ACTIVE_VERSION,encoded=env.CLAIM_HASH_KEYS;if(activeVersion===undefined||encoded===undefined)throw new Error("Required claim hash key configuration is missing.");let value:unknown;try{value=JSON.parse(encoded);}catch{throw new Error("Claim hash key configuration is malformed.");}if(typeof value!=="object"||value===null||Array.isArray(value))throw new Error("Claim hash key configuration is malformed.");return{activeVersion,keys:Object.entries(value).map(([version,secret])=>{if(typeof secret!=="string")throw new Error("Claim hash key configuration is malformed.");return{version,secret};})};}
