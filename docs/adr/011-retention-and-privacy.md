# ADR 011 — Retention and Privacy Architecture

## Status

Accepted

## Date

2026-09-08

## Context

Sprint 0 assumed blanket "soft delete only" for all entities. This is
insufficient: historical sporting/financial records may need preservation
without retaining unnecessary personal data indefinitely. The platform
explicitly considers minors, whose data may have shorter retention
requirements. Different types of "deletion" have different semantics: account
closure, deactivation, archival, and anonymization are distinct operations.
Privacy regulations may require pseudonymization after a retention period.

## Decision

Replace blanket "soft delete only" with a layered retention model:

1. **Account closure** — the `User` (auth subject) is disabled. Login stops.
   Personal data is preserved. Historical records are untouched.
2. **Person deactivation** — `Person.lifecycleStatus` → `deactivated`. No new
   activity is permitted. Personal data is preserved. Reactivation is possible.
3. **Identity archival** — `Person.lifecycleStatus` → `archived`. The Person
   record becomes immutable. A minimal identity set is retained. Historical
   records are untouched.
4. **Legal/business retention** — records are kept for the statutory/contractual
   retention period. Personal data is preserved per retention policy.
5. **Anonymization/pseudonymization** — after the retention period, personal
   data is removed or replaced with pseudonymous identifiers. Historical
   records (results, achievements, ledgers) are retained with anonymized
   references.
6. **Historical competition preservation** — results, achievements, and
   competition records are always preserved. They may reference anonymized
   Person/AthleteProfile identifiers after anonymization.
7. **Audit/financial retention** — financial records (`PaymentTransaction`,
   `Refund`, `Settlement`, `RewardsLedgerEntry`) are kept per tax/audit law.
   Personal data is minimized.

### Minors

- Minor data may have shorter retention periods than adult data.
- Guardian relationships are considered in anonymization decisions.
- A minor's Person may transition to full control at age of majority,
  retaining their SportsId and historical records.

### Privacy workflows are NOT implemented this sprint

The architecture defines the layered model and lifecycle states. Automated
retention enforcement, anonymization jobs, and consent management are future
implementations.

See `audit-integrity.md`, `identity-model.md`.

## Consequences

**Positive:**
- Historical records are preserved even after personal data is anonymized.
- Minors are explicitly considered in retention.
- Different "deletion" types have clear, distinct semantics.
- Privacy compliance is architecturally supportable.

**Negative:**
- Retention policies must be defined per jurisdiction (future work).
- Anonymization must carefully preserve historical record integrity while
  removing personal data — complex implementation ahead.
- References from historical records to Person/AthleteProfile must handle
  anonymized identifiers gracefully.

## Alternatives considered

- **Blanket soft-delete only (Sprint 0).** Rejected: does not address
  privacy requirements for data minimization after retention periods; does
  not consider minors; conflates different deletion semantics.
- **Hard delete after retention.** Rejected: would orphan historical records
  (results referencing a deleted Person); violates R20.
- **No retention management.** Rejected: retains personal data indefinitely,
  which may violate privacy regulations.

## Compliance

- `Person.lifecycleStatus` field supports `active | deactivated | archived |
  anonymized`.
- Historical records (CompetitionResult, Achievement, PaymentTransaction,
  RewardsLedgerEntry) are never deleted.
- `Person` and `AthleteProfile` records are retained (archived/anonymized),
  never hard-deleted.
- Minor/guardian relationships are considered in retention documentation.
- Privacy workflow implementation is deferred (not this sprint).
