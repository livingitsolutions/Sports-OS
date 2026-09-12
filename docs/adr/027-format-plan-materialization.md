# ADR 027: Format plan materialization

Competition format engines remain pure, deterministic, identity-neutral, and persistence-free. A trusted application use case derives scope and active entrant count, resolves an engine, validates its transient plan, maps logical references to generated aggregate IDs, and constructs existing Stage and Contest aggregates.

Generated Stages carry a nullable CompetitionFormat source reference; manual Stages carry no source. Infrastructure atomically inserts a one-per-format marker, Stages, and Contests in one PostgreSQL transaction. Progression rules are validated but deliberately not persisted or executed.
