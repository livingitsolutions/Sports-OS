import type {
  CompetitionEntryLookup,
  CompetitionEntryPersistenceError,
  CompetitionEntryRepository,
} from "@app/contracts/competition-entry-repository";
import type { CompetitionEntry } from "@domain/competition/competition-entry.types";
import type { Id, Result } from "@shared/kernel";
const bad = (
  kind: CompetitionEntryPersistenceError["kind"],
): Result<never, CompetitionEntryPersistenceError> => ({
  ok: false,
  error: { kind },
});
export class InMemoryCompetitionEntryRepository implements CompetitionEntryRepository {
  private readonly entries = new Map<string, CompetitionEntry>();
  async create(x: CompetitionEntry) {
    if (this.entries.has(x.id)) return bad("duplicate_id");
    if (this.activeConflict(x)) return bad("already_active");
    this.entries.set(x.id, x);
    return { ok: true as const, value: x };
  }
  async save(x: CompetitionEntry, v: number) {
    const old = this.entries.get(x.id);
    if (!old) return bad("parent_not_found");
    if (old.version !== v || x.version !== v + 1)
      return bad("concurrency_conflict");
    this.entries.set(x.id, x);
    return { ok: true as const, value: x };
  }
  async findById(id: Id<"CompetitionEntry">) {
    return this.lookup(this.entries.get(id));
  }
  async findActiveAthleteEntry(c: Id<"Competition">, a: Id<"AthleteProfile">) {
    return this.lookup(
      [...this.entries.values()].find(
        (x) =>
          x.status === "active" &&
          x.entrantType === "athlete" &&
          x.competitionId === c &&
          x.athleteProfileId === a,
      ),
    );
  }
  async findActiveTeamEntry(c: Id<"Competition">, t: Id<"Team">) {
    return this.lookup(
      [...this.entries.values()].find(
        (x) =>
          x.status === "active" &&
          x.entrantType === "team" &&
          x.competitionId === c &&
          x.teamId === t,
      ),
    );
  }
  private lookup(x?: CompetitionEntry): CompetitionEntryLookup {
    return x ? { kind: "found", competitionEntry: x } : { kind: "not_found" };
  }
  private activeConflict(x: CompetitionEntry) {
    return (
      x.status === "active" &&
      [...this.entries.values()].some(
        (y) =>
          y.status === "active" &&
          y.competitionId === x.competitionId &&
          ((x.entrantType === "athlete" &&
            y.entrantType === "athlete" &&
            y.athleteProfileId === x.athleteProfileId) ||
            (x.entrantType === "team" &&
              y.entrantType === "team" &&
              y.teamId === x.teamId)),
      )
    );
  }
}
