# Organization Model

Organization is the platform identity for a structured body such as a club,
league, association, federation, school, government sports body, company,
event organizer, or venue operator. It may exist without people, teams, or
events. It is not a Person, Account, Team, Membership, or Role.

Organization has no `tenantId`. Organization-owned resources may later use
`organizationId` as an isolation boundary, but that ownership model is not
implemented here. Person-to-Organization relationships belong to a future
Membership capability.

`Organization.type` is descriptive classification only. It grants no
permissions and implies no verification, governing or sanctioning authority,
or subscription state. Those capabilities remain separate.

The platform-wide slug is normalized for future public URLs and kept unique by
persistence. Country is represented only by a two-letter uppercase ISO-style
`countryCode`; addresses, jurisdiction, and geography hierarchy are deferred.

Team remains a separate competing-unit concept. An Organization is not a Team,
and an Organization does not require teams to exist. Sprint 6 adds no Team
behavior, persistence, membership, roster, or authorization.
