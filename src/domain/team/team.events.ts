import type { DomainEvent } from "@domain/aggregate";
import type { Id } from "@shared/kernel";

export interface TeamEvent extends DomainEvent {
  readonly type: "team.team_created" | "team.team_deactivated" | "team.team_reactivated";
  readonly aggregateType: "Team";
  readonly teamId: Id<"Team">;
  readonly organizationId: Id<"Organization">;
  readonly sportId: Id<"Sport">;
  readonly version: number;
}
