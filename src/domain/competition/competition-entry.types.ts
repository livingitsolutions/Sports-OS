import type { AggregateRoot, AggregateVersion } from "@domain/aggregate";
import type { Id, ISODateString } from "@shared/kernel";

export type CompetitionEntrantType = "athlete" | "team";
export type CompetitionEntryStatus = "active" | "withdrawn";

export interface CompetitionEntry extends AggregateRoot<"CompetitionEntry"> {
  readonly competitionId: Id<"Competition">;
  readonly divisionId: Id<"Division"> | null;
  readonly entrantType: CompetitionEntrantType;
  readonly athleteProfileId: Id<"AthleteProfile"> | null;
  readonly teamId: Id<"Team"> | null;
  readonly status: CompetitionEntryStatus;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly version: AggregateVersion;
}
