# Issue Person Claim

`IssuePersonClaim` is an internal use case only. No public HTTP endpoint invokes
it. A future trusted administrative or onboarding boundary must authorize its
caller; this sprint deliberately does not invent roles or organizer authority.

Issuance verifies that the Person exists, is active, and has no Account. It
generates 32 cryptographically random bytes, returns the base64url bearer token
once, and persists only an HMAC-SHA-256 digest produced with a server-held
pepper. The token's 256 bits of entropy resist guessing; HMAC also prevents a
database-only attacker from testing candidate values without the pepper. The
pepper and raw token must never be logged. A new claim expires after an explicit
lifetime and atomically revokes any prior pending claim for the Person.

The raw token remains sensitive until consumed or expired. Future delivery and
secret rotation require separate designs and are not implemented here.
