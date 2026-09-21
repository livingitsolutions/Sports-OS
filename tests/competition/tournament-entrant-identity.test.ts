import { describe, expect, it } from "vitest";
import { PgTournamentOperationsReader, assembleTournamentOperationsSnapshot } from "../../src/adapters/persistence/pg/pg-tournament-operations-reader";

const head = {
  format_id: "format-1",
  competition_id: "competition-1",
  division_id: null,
  kind: "single_elimination",
  format_status: "active",
  event_id: "event-1",
  sport_id: "sport-1",
  competition_status: "active",
  organization_id: "organization-1",
  entrant_count: 3,
  seed_finalized_at: null,
};

describe("Tournament Operations entrant identity", () => {
  it("projects mixed team and athlete identities and makes unresolved identity explicit", () => {
    const snapshot = assembleTournamentOperationsSnapshot(
      head,
      [],
      [],
      [],
      [],
      [],
      [
        { competition_entry_id: "team-entry", entrant_type: "team", team_name: "Harbor Lions", person_display_name: null },
        { competition_entry_id: "athlete-entry", entrant_type: "athlete", team_name: null, person_display_name: "Jordan Reyes" },
        { competition_entry_id: "unavailable-entry", entrant_type: "athlete", team_name: null, person_display_name: null },
      ],
    );

    expect(snapshot.entrants).toEqual([
      { competitionEntryId: "team-entry", entrantType: "team", identityStatus: "resolved", displayName: "Harbor Lions" },
      { competitionEntryId: "athlete-entry", entrantType: "athlete", identityStatus: "resolved", displayName: "Jordan Reyes" },
      { competitionEntryId: "unavailable-entry", entrantType: "athlete", identityStatus: "unavailable" },
    ]);
  });

  it("resolves every entrant with one set-based query and a constant projection query count", async () => {
    let queryCount = 0;
    const tx = (parts: TemplateStringsArray) => {
      queryCount += 1;
      const query = parts.join("?");
      if (query.includes("FROM competition_formats f")) return Promise.resolve([head]);
      if (query.includes("FROM competition_entries ce")) return Promise.resolve([
        { competition_entry_id: "athlete-entry", entrant_type: "athlete", team_name: null, person_display_name: "Jordan Reyes" },
      ]);
      return Promise.resolve([]);
    };
    const sql = {
      begin: async (_options: string, run: (transaction: typeof tx) => Promise<unknown>) => run(tx),
    };
    const result = await new PgTournamentOperationsReader(sql as never).read("format-1");
    expect(result).toMatchObject({ kind: "found", snapshot: { entrants: [{ displayName: "Jordan Reyes" }] } });
    expect(queryCount).toBe(7);
  });
});
