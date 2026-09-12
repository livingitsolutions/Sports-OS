# ADR-026: Transient Single-Elimination Planning

## Status

Accepted — Sprint 10.1.

## Decision

Single elimination is generated as a pure transient source-to-contest graph. The bracket uses the next power-of-two size and conventional recursive mirror-complement seed placement. Seeds beyond entrant count are absent slots. When an actual seed is paired with an absent slot, that seed feeds the next round directly; a bye is never represented as a Contest or sporting result.

Only capacity-two Contests that may need a result are planned. Each Contest position has one seed or previous-winner source, each non-final winner has one target, and the Final is the structural endpoint without champion semantics.

## Consequences

Plans are deterministic, identity-neutral, and always contain `entrantCount - 1` Contests. No repository, database schema, durable Stage or Contest, participant assignment, result handling, or progression execution is introduced.
