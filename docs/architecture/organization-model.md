# Organization Model

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
governing authority remains separate. First-administrator/bootstrap design is
deferred: there is no owner field, creator bypass, or permanent super-admin.

`Organization.type` is descriptive classification only. It grants no
permissions and implies no verification, governing or sanctioning authority,
or subscription state. Those capabilities remain separate.

The platform-wide slug is normalized for future public URLs and kept unique by
persistence. Country is represented only by a two-letter uppercase ISO-style
`countryCode`; addresses, jurisdiction, and geography hierarchy are deferred.

Team remains a separate competing-unit concept. An Organization is not a Team,
and an Organization does not require teams to exist. Sprint 6 adds no Team
behavior, roster, or authorization. Membership events are published after
successful persistence; without an outbox, persistence and publication remain
non-atomic.
