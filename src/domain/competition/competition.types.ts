import type { Id } from "@shared/kernel";
import type { CompetitionMeasure } from "@shared/measurement";

/**
 * Competition aggregate boundaries (see ADR-005, ADR-013,
 * docs/architecture/competition-model.md).
 *
 * Re-evaluated from Sprint 0: EventContainer containing CompetitionEvent
 * children was an unbounded aggregate. National-scale events contain many
 * sports, divisions, competitions, matches/heats/bouts/races and participants.
 * Each level is an independent aggregate lifecycle to avoid unbounded
 * aggregates and allow concurrency at scale.
 *
 * Hierarchy (independent aggregates, not parent-child within one aggregate):
 *   Event → Competition → Division/Category → Stage → Contest (future)
 */

/**
 * Event — the top-level organized occurrence (a tournament, league, or
 * standalone event). Organized by an Organization. Tenant-owned.
 */
export type EventKind = "tournament" | "league" | "standalone";

export interface CompetitionEvent {
  readonly id: Id<"Event">;
  readonly tenantId: Id<"Tenant">;
  readonly kind: EventKind;
  readonly name: string;
  readonly organizerOrganizationId: Id<"Organization">;
}

/**
 * Competition — a specific sport/discipline competition within an Event.
 * References its parent Event by ID (independent aggregate, not a child entity).
 */
export type EventFormat =
  | "single_elimination"
  | "double_elimination"
  | "round_robin"
  | "swiss"
  | "timed_finals"
  | "measured_final"
  | "judged"
  | "group_then_knockout";

export type ParticipantKind = "individual" | "team";

export interface Competition {
  readonly id: Id<"Competition">;
  readonly tenantId: Id<"Tenant">;
  readonly eventId: Id<"Event">;
  readonly sportId: Id<"Sport">;
  readonly disciplineId: Id<"Discipline"> | null;
  readonly format: EventFormat;
  readonly participantKind: ParticipantKind;
  readonly measure: CompetitionMeasure;
}

/**
 * Division / Category — an age group, weight class, skill level, or other
 * partitioning within a Competition. Independent aggregate.
 */
export interface Division {
  readonly id: Id<"Division">;
  readonly tenantId: Id<"Tenant">;
  readonly competitionId: Id<"Competition">;
  readonly name: string;
  readonly label: string;
}

/**
 * Stage — a phase within a Division's competition structure
 * (e.g. preliminary round, semifinal, final). Independent aggregate.
 */
export type StageKind =
  | "preliminary"
  | "group"
  | "quarterfinal"
  | "semifinal"
  | "final"
  | "round"
  | "session";

export interface Stage {
  readonly id: Id<"Stage">;
  readonly tenantId: Id<"Tenant">;
  readonly divisionId: Id<"Division">;
  readonly kind: StageKind;
  readonly name: string;
  readonly sequence: number;
}

/**
 * Contest — a single match/heat/bout/race within a Stage. Future aggregate;
 * its concrete shape (Match, Heat, Bout, Race) will be discriminated by a
 * ContestKind. Defined as a forward-looking seam, not implemented this sprint.
 */
export type ContestKind =
  | "match"
  | "heat"
  | "bout"
  | "race"
  | "performance"
  | "attempt";

export interface Contest {
  readonly id: Id<"Contest">;
  readonly tenantId: Id<"Tenant">;
  readonly stageId: Id<"Stage">;
  readonly contestKind: ContestKind;
}
