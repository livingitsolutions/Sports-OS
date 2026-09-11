# Deactivate Person

Status: implemented in Sprint 4.2 (architecture version v0.6.2).

`DeactivatePerson` is the narrow first optimistic-concurrency mutation. It
loads a typed Person lookup at version N, asks domain behavior to perform the
active-to-deactivated transition, and receives the updated Person plus a
`PersonDeactivated` fact at N+1. The repository saves that supplied state with
expected version N. Only after persistence succeeds does the use case publish
the previously produced event and return the updated Person.

`not_found`, unavailable storage, invalid stored data, stale writes, and invalid
domain transitions are typed failures. None publishes an event. The event
contains only identifiers, timestamp, type, and aggregate version—no display
name, birth date, or Sports ID.

This is persistence-then-publication, not atomic database/event delivery. No
transactional outbox or durable publication guarantee is implemented here.
