# Organization Model

Organization creation and Organization authority are deliberately separate.
Creation never grants authorization. Initial administration requires an
explicit trusted, one-time bootstrap transaction and is represented only by
the ordinary active membership → active role assignment → active
Organization-scoped system role graph. There is no owner field or bypass.

Organization is the platform identity for a structured body such as a club,
league, association, federation, school, government sports body, company,
event organizer, or venue operator. It may exist without people, teams, or
events. It is not a Person, Account, Team, Membership, or Role.

Organization and Person are separate aggregate roots. Their explicit relationship
is OrganizationMembership: a Person may belong to many Organizations and an
Organization may have many membership relations, with exactly one persisted
record per Person/Organization pair. Inactive membership remains persisted.

OrganizationMembership is organization-scoped and its isolation owner is
`organizationId`. Organization remains the tenancy root, so neither Organization
nor OrganizationMembership gains a `tenantId` column. Membership status records
belonging only; it is not authorization. Membership contains no role or
permission.

Organization authorization attaches roles to membership through explicit role
assignments. Membership alone grants nothing. Evaluation defaults to deny and
requires an active membership, active assignment, active same-organization role,
and an explicit stable permission. Role name/key and Organization type grant
nothing by themselves. There are no wildcards, permission inheritance, nested
roles, or cross-organization assignments. Roles are not Person identity, and
governing authority remains separate. Trusted onboarding composes Organization
creation with the frozen first-administrator bootstrap in one transaction;
there is no owner field, creator bypass, or permanent super-admin.

`Organization.type` is descriptive classification only. It grants no
permissions and implies no verification, governing or sanctioning authority,
or subscription state. Those capabilities remain separate.

Trusted onboarding is a narrow internal application boundary, not public
self-service signup and not platform-global administrator authority. Its opaque
composition-issued capability cannot be reconstructed from JSON. A stable
request key makes successful replay return the originally committed graph,
while global slug uniqueness rejects distinct competing requests. Onboarding
trust and governing-body trust are independent: an Organization can exist and
be administered without being verified, sanctioned, or accredited.

The platform-wide slug is normalized for future public URLs and kept unique by
persistence. Country is represented only by a two-letter uppercase ISO-style
`countryCode`; addresses, jurisdiction, and geography hierarchy are deferred.

Team remains a separate competing-unit concept. An Organization is not a Team,
and an Organization does not require teams to exist. Sprint 6 adds no Team
behavior, roster, or authorization. Onboarding events are published only after
a successful commit. Without an outbox, delivery can still fail after
persistence and exactly-once delivery is not claimed.
