import type { CompetitionEntry } from "@domain/competition/competition-entry.types";
import type { Id, Result } from "@shared/kernel";

export type CompetitionEntryPersistenceError = {
  kind:
    | "duplicate_id"
    | "already_active"
    | "parent_not_found"
    | "concurrency_conflict"
    | "invalid_persistence_state"
    | "unavailable";
  detail?: string;
};
export type CompetitionEntryLookup =
  | { kind: "found"; competitionEntry: CompetitionEntry }
  | { kind: "not_found" }
  | { kind: "invalid_persistence_state" | "unavailable"; detail?: string };
export interface CompetitionEntryRepository {
  create(
    entry: CompetitionEntry,
  ): Promise<Result<CompetitionEntry, CompetitionEntryPersistenceError>>;
  save(
    updated: CompetitionEntry,
    expectedVersion: number,
  ): Promise<Result<CompetitionEntry, CompetitionEntryPersistenceError>>;
  findById(id: Id<"CompetitionEntry">): Promise<CompetitionEntryLookup>;
  findActiveAthleteEntry(
    competitionId: Id<"Competition">,
    athleteProfileId: Id<"AthleteProfile">,
  ): Promise<CompetitionEntryLookup>;
  findActiveTeamEntry(
    competitionId: Id<"Competition">,
    teamId: Id<"Team">,
  ): Promise<CompetitionEntryLookup>;
}
