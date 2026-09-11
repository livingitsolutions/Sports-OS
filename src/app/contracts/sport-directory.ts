import type { Id } from "@shared/kernel";

/**
 * SportDirectory — the minimum application-facing query the Athlete context
 * needs to validate that a Sport exists before recording participation.
 *
 * This is deliberately a read-only existence check, NOT a Sports Catalog CRUD
 * surface: Sprint 3 does not implement catalog management. The real
 * implementation will be backed by the Sports Catalog context (via a published
 * query port); an in-memory implementation stands in for now.
 *
 * Contracts, not domain internals, are how the Athlete context reaches the
 * Sports Catalog — the two domains never import each other (ADR-018, ADR-019).
 */
export interface SportDirectory {
  exists(sportId: Id<"Sport">): Promise<boolean>;
}
