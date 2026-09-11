import type { SportDirectory } from "@app/contracts/sport-directory";
import type { Id } from "@shared/kernel";

/**
 * In-memory SportDirectory.
 *
 * A deterministic stand-in for the future Sports Catalog query port. It answers
 * only "does this Sport exist?" from a fixed set of known Sport IDs — it is NOT
 * a Sports Catalog and provides no management operations. Tests seed the set
 * they need; production wiring seeds it explicitly and treats it as temporary
 * until the real catalog exists.
 */
export class InMemorySportDirectory implements SportDirectory {
  private readonly known: Set<string>;

  constructor(sportIds: ReadonlyArray<Id<"Sport">> = []) {
    this.known = new Set(sportIds);
  }

  async exists(sportId: Id<"Sport">): Promise<boolean> {
    return this.known.has(sportId);
  }

  /** Register a known Sport ID (test/seed helper — not catalog management). */
  add(sportId: Id<"Sport">): void {
    this.known.add(sportId);
  }
}
