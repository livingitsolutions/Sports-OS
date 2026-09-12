import type { AggregateRoot, AggregateVersion } from "@domain/aggregate";
import type { Id, ISODateString } from "@shared/kernel";

export type TeamStatus = "active" | "inactive";
export interface Team extends AggregateRoot<"Team"> {
  readonly organizationId: Id<"Organization">;
  readonly sportId: Id<"Sport">;
  readonly name: string;
  readonly key: string;
  readonly status: TeamStatus;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly version: AggregateVersion;
}
