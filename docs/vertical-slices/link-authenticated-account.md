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
