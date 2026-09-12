import {
  INITIAL_AGGREGATE_VERSION,
  nextAggregateVersion,
} from "@domain/aggregate";
import type {
  CompetitionEntry,
  CompetitionEntrantType,
} from "@domain/competition/competition-entry.types";
import type { DomainEvent } from "@domain/aggregate";
import type { DomainError, Id, ISODateString, Result } from "@shared/kernel";
import { Result as R } from "@shared/kernel";

export interface CompetitionEntryEvent extends DomainEvent {
  readonly type: "competition.entry_created" | "competition.entry_withdrawn";
  readonly competitionEntryId: Id<"CompetitionEntry">;
  readonly competitionId: Id<"Competition">;
  readonly divisionId: Id<"Division"> | null;
  readonly entrantType: CompetitionEntrantType;
  readonly athleteProfileId: Id<"AthleteProfile"> | null;
  readonly teamId: Id<"Team"> | null;
  readonly version: number;
}
type Meta = { now: ISODateString; domainEventId: string };
type Made = { entry: CompetitionEntry; event: CompetitionEntryEvent };
const error = (code: string, message: string): DomainError => ({
  code,
  message,
});

function event(
  entry: CompetitionEntry,
  type: CompetitionEntryEvent["type"],
  meta: Meta,
): CompetitionEntryEvent {
  return {
    type,
    eventId: meta.domainEventId,
    occurredAt: meta.now,
    aggregateId: entry.id,
    aggregateType: "CompetitionEntry",
    competitionEntryId: entry.id,
    competitionId: entry.competitionId,
    divisionId: entry.divisionId,
    entrantType: entry.entrantType,
    athleteProfileId: entry.athleteProfileId,
    teamId: entry.teamId,
    version: entry.version,
  };
}

export function createCompetitionEntry(
  input: {
    id: Id<"CompetitionEntry">;
    competitionId: Id<"Competition">;
    divisionId?: Id<"Division"> | null;
    entrantType: CompetitionEntrantType;
    athleteProfileId?: Id<"AthleteProfile"> | null;
    teamId?: Id<"Team"> | null;
  } & Meta,
): Result<Made, DomainError> {
  const athleteProfileId = input.athleteProfileId ?? null;
  const teamId = input.teamId ?? null;
  const valid =
    input.entrantType === "athlete"
      ? athleteProfileId !== null && teamId === null
      : teamId !== null && athleteProfileId === null;
  if (!input.id.trim() || !input.competitionId.trim() || !valid)
    return R.fail(
      error(
        "invalid_entrant_identity",
        "Exactly one entrant identity matching entrantType is required.",
      ),
    );
  const entry: CompetitionEntry = {
    id: input.id,
    competitionId: input.competitionId,
    divisionId: input.divisionId ?? null,
    entrantType: input.entrantType,
    athleteProfileId,
    teamId,
    status: "active",
    createdAt: input.now,
    updatedAt: input.now,
    version: INITIAL_AGGREGATE_VERSION,
  };
  return R.ok({
    entry,
    event: event(entry, "competition.entry_created", input),
  });
}

export function withdrawCompetitionEntry(
  entry: CompetitionEntry,
  meta: Meta,
): Result<Made, DomainError> {
  if (entry.status === "withdrawn")
    return R.fail(
      error("already_withdrawn", "Competition entry is already withdrawn."),
    );
  const updated: CompetitionEntry = {
    ...entry,
    status: "withdrawn",
    updatedAt: meta.now,
    version: nextAggregateVersion(entry.version),
  };
  return R.ok({
    entry: updated,
    event: event(updated, "competition.entry_withdrawn", meta),
  });
}
