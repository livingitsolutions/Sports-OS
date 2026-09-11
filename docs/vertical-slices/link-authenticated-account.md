# Link Authenticated Account to Existing Person

Sprint 5.1 secures the authentication vertical slice. A provider-neutral
`AuthIdentityProvider` supplies the current server-validated subject, while a
raw one-time claim token is hashed and resolved to a pending PersonClaim. The
Person ID is derived only from that claim. The use case checks the existing
active Person and both unique linkage directions, then atomically creates the
Account and consumes the claim through a narrow persistence contract.

The use case never accepts an auth subject or Person ID as input and never creates a Person.
Supabase session/user types are confined to the authentication adapter. Account
stores no credentials, access or refresh tokens, roles, sports data, or profile
data.

Authentication answers “Who is logged in?” PersonClaim answers “Which existing
Person may this identity claim?” Account is the persistent authentication
identity linkage. Person remains the platform human identity. Authentication
alone never authorizes Person linkage.
## Authenticated server boundary

Claim consumption is exposed only as `POST /account/link-person`, implemented
by a Netlify server function. Claim issuance remains internal-only and has no
route. The request body is exactly `{ "claimCredential": "..." }`; Person ID,
auth subject, account ID, roles, and authorization flags are rejected.

The request flow is:

`Client → Netlify server endpoint → request-scoped Supabase auth.getUser() → provider-neutral AuthIdentity → PersonClaim verification → atomic Account/Person linkage transaction`.

Authentication proves who is logged in. PersonClaim proves which Person that
identity may link. The endpoint validates the caller bearer with Supabase; it
does not decode and trust JWT claims or accept a client user ID. Each request
gets a new Supabase client carrying only that caller's Authorization header and
a new database-backed linkage runtime. No caller-authenticated client is global.

Transport validation requires POST, `application/json`, a syntactically valid
Bearer header, an 8 KiB maximum body, and one credential string no longer than
256 characters. Responses are JSON with `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff`; no wildcard CORS is enabled.

Public error policy is conservative: missing/invalid authentication is 401;
malformed shape is 400 (or 413/415 for size/media type); invalid, expired, or
revoked claims share a 400 `claim_unusable` response; consumed claims and safe
link conflicts are 409; auth/database unavailability is 503; unexpected errors
are 500. Provider/database detail, stack traces, bearer values, credentials,
hashes, and configuration are never returned.

Required runtime variables are `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`CLAIM_HASH_ACTIVE_VERSION`, `CLAIM_HASH_KEYS`, and `DATABASE_URL` (or the
existing `SUPABASE_DB_URL` fallback). The public Supabase key is used with the
caller's bearer for `auth.getUser()`; a service-role identity is not used as the
caller.
