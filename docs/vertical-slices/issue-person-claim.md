# Issue Person Claim

`IssuePersonClaim` is an internal use case only. No public HTTP endpoint invokes
it. A future trusted administrative or onboarding boundary must authorize its
caller; this sprint deliberately does not invent roles or organizer authority.

Issuance verifies that the Person exists, is active, and has no Account. It
generates 32 cryptographically random bytes, returns the base64url bearer token
once, and persists only an HMAC-SHA-256 digest produced with a server-held
pepper. The token's 256 bits of entropy resist guessing; HMAC also prevents a
database-only attacker from testing candidate values without the pepper. The
key material and raw token must never be logged. A new claim expires after an explicit
lifetime and atomically revokes any prior pending claim for the Person.

## Security identities

- **Authentication** answers “Who is logged in?” through the external auth subject on `Account`.
- **PersonClaim** answers “Which existing Person may be claimed?” without accepting a Person ID from the linking caller.
- **Claim issuer** answers “Who or what authorized issuance?” A trusted composition-bound principal (`system`, `admin`, or `onboarding`, plus a non-sensitive subject) is mandatory and is stored on the claim. A request boolean cannot create this principal.
- **Hash key version** answers “Which configured server-side HMAC key validates this claim?” It is non-secret and immutable.

## Credential and lookup

Credentials use `version.lookup.secret`. Version and lookup are non-secret;
lookup and secret are independent 256-bit random base64url values. PostgreSQL
stores a unique indexed lookup ID, the version, and `HMAC-SHA-256(version.lookup.secret)`.
It never stores the bearer secret. Verification parses the bounded format,
loads exactly one claim by lookup ID, requires the credential and row versions
to match, and asks the key provider to verify with exactly that version using a
constant-time comparison. It never scans claims, tries every key, or falls back.

## Runtime configuration and rotation

Production uses `CLAIM_HASH_ACTIVE_VERSION` (for example `v2`) and
`CLAIM_HASH_KEYS`, a JSON object mapping versions to secrets (for example a JSON
object with `v1` and `v2` properties; real values belong only in runtime secret
configuration). Each secret must contain at least 32 characters. Startup fails
for missing/malformed configuration, invalid or duplicate versions, invalid
secrets, or an active version absent from the key set. Errors never include key
values.

Rotation procedure:

1. Add the new key version while retaining old versions.
2. Keep every historical key referenced by a usable claim.
3. Set the new version active.
4. Issue new claims; they use the active version.
5. Continue verifying outstanding claims with their stored versions.
6. Retire an old key only after no pending, unexpired claim references it.

An unavailable historical version returns the typed `hash_key_unavailable`
failure. No automated key deletion is performed.

`createTrustedClaimIssuanceRuntime` is the production-capable internal
composition boundary. It wires configuration, token crypto, PostgreSQL Person,
Account and PersonClaim repositories, and `IssuePersonClaim`; it does not create
a public claim endpoint.

Migration 0006 deterministically marks pre-release disposable rows with
`legacy_v1`, derives a non-secret lookup ID from the claim ID, and records the
migration as issuer. Existing token hashes are not rewritten, and these legacy
rows are not valid under the new credential format.

The raw token remains sensitive until consumed or expired. Future delivery and
secret rotation require separate designs and are not implemented here.
