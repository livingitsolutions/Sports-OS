# ADR-025: Competition Format Foundation

## Status

Accepted — Sprint 10.

## Decision

CompetitionFormat is an independent durable aggregate recording format intent at Competition or optional Division scope. Stage, Contest, CompetitionEntry, and format plans remain separate. PostgreSQL is authoritative for active-scope uniqueness and same-Competition Division integrity.

Format engines are pure domain contracts. A registry resolves only engines actually registered; catalog membership does not promise implementation. Planning consumes structural entrant count and produces a transient, logical-reference plan with generic capacities and progression sources. Engines never persist, publish events, query repositories, access identities, or use time, randomness, or network services.

## Consequences

Format history is durable while generated structure stays outside the format aggregate. Future orchestration can translate plans into independent Stage and Contest aggregates, then separately assign entrants and execute result-driven progression.
