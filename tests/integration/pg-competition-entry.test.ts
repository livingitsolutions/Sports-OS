import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { PgCompetitionEntryRepository } from "@adapters";
import {
  createCompetitionEntry,
  withdrawCompetitionEntry,
} from "@domain/competition/competition-entry";
import type { Sql } from "@adapters";
import type { Id, ISODateString } from "@shared/kernel";
const URL = process.env.TEST_DATABASE_URL ?? "",
  RUN = !!URL,
  P = `entry-${Date.now()}`,
  NOW = "2026-09-12T10:00:00.000Z" as ISODateString,
  id = <T extends string>(x: string) => `${P}-${x}` as Id<T>,
  meta = { now: NOW, domainEventId: "event" };
describe.skipIf(!RUN)("PostgreSQL CompetitionEntry", () => {
  let sql: Sql, repo: PgCompetitionEntryRepository;
  beforeAll(async () => {
    sql = postgres(URL, { ssl: "require", max: 4, onnotice: () => {} }) as Sql;
    repo = new PgCompetitionEntryRepository(sql);
    await sql`INSERT INTO organizations(id,name,slug,type,status,country_code,version,created_at,updated_at) VALUES(${id<"Organization">("org-a")},'Organizer A',${`${P}-a`},'club','active','US',1,${NOW},${NOW}),(${id<"Organization">("org-b")},'Entrant B',${`${P}-b`},'club','active','US',1,${NOW},${NOW})`;
    await sql`INSERT INTO persons(id,display_name,lifecycle_status,version,created_at,updated_at) VALUES(${id<"Person">("person")},'Athlete','active',1,${NOW},${NOW})`;
    await sql`INSERT INTO athlete_profiles(id,person_id,status,version,created_at) VALUES(${id<"AthleteProfile">("athlete")},${id<"Person">("person")},'active',1,${NOW})`;
    await sql`INSERT INTO events(id,organization_id,name,key,status,created_at,updated_at,version) VALUES(${id<"Event">("event")},${id<"Organization">("org-a")},'Games','games','active',${NOW},${NOW},1)`;
    await sql`INSERT INTO competitions(id,event_id,sport_id,name,key,status,created_at,updated_at,version) VALUES(${id<"Competition">("competition")},${id<"Event">("event")},'sport-basketball','Open','open','active',${NOW},${NOW},1),(${id<"Competition">("other")},${id<"Event">("event")},'sport-basketball','Other','other','active',${NOW},${NOW},1)`;
    await sql`INSERT INTO competition_divisions(id,competition_id,name,key,status,created_at,updated_at,version) VALUES(${id<"Division">("division")},${id<"Competition">("competition")},'U18','u18','active',${NOW},${NOW},1),(${id<"Division">("other-division")},${id<"Competition">("other")},'Other','other','active',${NOW},${NOW},1)`;
    await sql`INSERT INTO teams(id,organization_id,sport_id,name,key,status,created_at,updated_at,version) VALUES(${id<"Team">("team")},${id<"Organization">("org-b")},'sport-basketball','Visitors','visitors','active',${NOW},${NOW},1)`;
  });
  afterAll(async () => {
    await sql`DELETE FROM competition_entries WHERE id LIKE ${`${P}%`}`;
    await sql`DELETE FROM competition_divisions WHERE id LIKE ${`${P}%`}`;
    await sql`DELETE FROM competitions WHERE id LIKE ${`${P}%`}`;
    await sql`DELETE FROM events WHERE id LIKE ${`${P}%`}`;
    await sql`DELETE FROM teams WHERE id LIKE ${`${P}%`}`;
    await sql`DELETE FROM athlete_profiles WHERE id LIKE ${`${P}%`}`;
    await sql`DELETE FROM persons WHERE id LIKE ${`${P}%`}`;
    await sql`DELETE FROM organizations WHERE id LIKE ${`${P}%`}`;
    await sql.end({ timeout: 5 });
  });
  const athlete = (suffix: string) =>
    createCompetitionEntry({
      id: id<"CompetitionEntry">(suffix),
      competitionId: id<"Competition">("competition"),
      divisionId: id<"Division">("division"),
      entrantType: "athlete",
      athleteProfileId: id<"AthleteProfile">("athlete"),
      ...meta,
    });
  const team = (suffix: string) =>
    createCompetitionEntry({
      id: id<"CompetitionEntry">(suffix),
      competitionId: id<"Competition">("competition"),
      entrantType: "team",
      teamId: id<"Team">("team"),
      ...meta,
    });
  it("round trips athlete and cross-Organization Team entries", async () => {
    const a = athlete("athlete-entry"),
      t = team("team-entry");
    if (!a.ok || !t.ok) throw Error();
    expect(await repo.create(a.value.entry)).toMatchObject({ ok: true });
    expect(await repo.create(t.value.entry)).toMatchObject({ ok: true });
    expect(await repo.findById(a.value.entry.id)).toMatchObject({
      kind: "found",
      competitionEntry: {
        entrantType: "athlete",
        divisionId: id<"Division">("division"),
      },
    });
    expect(await repo.findById(t.value.entry.id)).toMatchObject({
      kind: "found",
      competitionEntry: { entrantType: "team", teamId: id<"Team">("team") },
    });
  });
  it("retains withdrawn history, permits re-entry, and rejects stale saves", async () => {
    const a = await repo.findById(id<"CompetitionEntry">("athlete-entry"));
    if (a.kind !== "found") throw Error();
    const w = withdrawCompetitionEntry(a.competitionEntry, meta);
    if (!w.ok) throw Error();
    expect(await repo.save(w.value.entry, 1)).toMatchObject({ ok: true });
    expect(await repo.save(w.value.entry, 1)).toMatchObject({
      ok: false,
      error: { kind: "concurrency_conflict" },
    });
    const again = athlete("athlete-reentry");
    if (!again.ok) throw Error();
    expect(await repo.create(again.value.entry)).toMatchObject({ ok: true });
    expect(await repo.findById(a.competitionEntry.id)).toMatchObject({
      competitionEntry: { status: "withdrawn" },
    });
  });
  it("makes partial uniqueness the concurrency authority for both entrant types", async () => {
    const existingTeam = await repo.findById(
      id<"CompetitionEntry">("team-entry"),
    );
    if (existingTeam.kind !== "found") throw Error();
    const tw = withdrawCompetitionEntry(existingTeam.competitionEntry, meta);
    if (!tw.ok) throw Error();
    await repo.save(tw.value.entry, 1);
    for (const kind of ["athlete", "team"] as const) {
      if (kind === "athlete") {
        const active = await repo.findById(
          id<"CompetitionEntry">("athlete-reentry"),
        );
        if (active.kind !== "found") throw Error();
        const aw = withdrawCompetitionEntry(active.competitionEntry, meta);
        if (!aw.ok) throw Error();
        await repo.save(aw.value.entry, 1);
      }
      const one =
          kind === "athlete"
            ? athlete(`${kind}-race-1`)
            : team(`${kind}-race-1`),
        two =
          kind === "athlete"
            ? athlete(`${kind}-race-2`)
            : team(`${kind}-race-2`);
      if (!one.ok || !two.ok) throw Error();
      const results = await Promise.all([
        repo.create(one.value.entry),
        repo.create(two.value.entry),
      ]);
      expect(results.filter((x) => x.ok)).toHaveLength(1);
      expect(results.filter((x) => !x.ok)[0]).toMatchObject({
        error: { kind: "already_active" },
      });
    }
  });
  it("enforces all FKs, checks, same-Competition Division integrity, RLS and zero policies", async () => {
    const base = [
      id<"CompetitionEntry">("bad"),
      id<"Competition">("competition"),
      null,
      "team",
      null,
      id<"Team">("team"),
      "withdrawn",
      NOW,
      NOW,
      1,
    ] as const;
    const insert = (v: readonly unknown[]) =>
      sql.unsafe(
        "INSERT INTO competition_entries VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        v as never,
      );
    for (const [index, value, code] of [
      [1, id<"Competition">("missing"), "23503"],
      [2, id<"Division">("other-division"), "23503"],
      [5, id<"Team">("missing"), "23503"],
      [3, "person", "23514"],
      [6, "pending", "23514"],
      [9, 0, "23514"],
    ] as const) {
      const row = [...base];
      row[0] = id<"CompetitionEntry">(`bad-${index}`);
      row[index] = value as never;
      await expect(insert(row)).rejects.toMatchObject({ code });
    }
    const athleteForeignKey = [...base];
    athleteForeignKey[0] = id<"CompetitionEntry">("bad-athlete-fk");
    athleteForeignKey[3] = "athlete";
    athleteForeignKey[4] = id<"AthleteProfile">("missing");
    athleteForeignKey[5] = null;
    await expect(insert(athleteForeignKey)).rejects.toMatchObject({ code: "23503" });
    const identity = [...base];
    identity[0] = id<"CompetitionEntry">("bad-identity");
    identity[4] = id<"AthleteProfile">("athlete");
    await expect(insert(identity)).rejects.toMatchObject({ code: "23514" });
    const rows = await sql<
      { relrowsecurity: boolean; policies: number }[]
    >`SELECT c.relrowsecurity,(SELECT count(*)::int FROM pg_policies p WHERE p.schemaname='public' AND p.tablename='competition_entries') policies FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='competition_entries'`;
    expect(rows).toEqual([{ relrowsecurity: true, policies: 0 }]);
  });
});
