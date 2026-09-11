import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { PgPersonRepository } from "@adapters/persistence/pg/pg-person-repository";
import { PgAthleteProfileRepository } from "@adapters/persistence/pg/pg-athlete-profile-repository";
import { PgSportDirectory } from "@adapters/persistence/pg/pg-sport-directory";
import type { Sql } from "@adapters/persistence/pg/connection";
import type { Person } from "@domain/identity/identity.types";
import type {
  AthleteProfile,
  AthleteSportParticipation,
} from "@domain/athlete/athlete.types";
import type { Id, ISODateString } from "@shared/kernel";
import { deactivatePerson } from "@domain/identity/person";

/**
 * PostgreSQL integration tests.
 *
 * These exercise the real database constraints (transactional Person+Sports ID
 * create, one-profile-per-person, one-active-participation-per-sport, re-entry
 * after ending) against a dedicated, DISPOSABLE PostgreSQL database.
 *
 * They are intentionally guarded on TEST_DATABASE_URL and SKIP cleanly when it
 * is absent. They are NEVER pointed at the production database automatically and
 * never fake a passing result: no URL means the suite is reported as skipped,
 * not passed. The target database must already have the Sprint 4 migrations
 * applied. Each run uses a unique key prefix and removes only its own rows.
 */
const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "";
const RUN_INTEGRATION = TEST_DB_URL.trim().length > 0;

const RUN_ID = `it_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const NOW = "2026-03-01T00:00:00.000Z" as ISODateString;

function key(suffix: string): string {
  return `${RUN_ID}_${suffix}`;
}

function person(idSuffix: string, sportsSuffix: string): Person {
  return {
    id: key(idSuffix) as Id<"Person">,
    version: 1 as never,
    updatedAt: NOW,
    displayName: "Integration Tester",
    dateOfBirth: "2000-01-01",
    lifecycleStatus: "active",
    sportsId: {
      value: key(sportsSuffix) as Id<"SportsId">,
      issuedAt: NOW,
      status: "active",
    },
  };
}

function profile(idSuffix: string, personIdSuffix: string): AthleteProfile {
  return {
    id: key(idSuffix) as Id<"AthleteProfile">,
    version: 1 as never,
    personId: key(personIdSuffix) as Id<"Person">,
    status: "active",
    createdAt: NOW,
  };
}

function participation(
  idSuffix: string,
  profileIdSuffix: string,
  sportId: string,
  status: "active" | "ended",
  endedAt: ISODateString | null,
): AthleteSportParticipation {
  return {
    id: key(idSuffix) as Id<"AthleteSportParticipation">,
    athleteProfileId: key(profileIdSuffix) as Id<"AthleteProfile">,
    sportId: sportId as Id<"Sport">,
    status,
    startedAt: NOW,
    endedAt,
  };
}

describe.skipIf(!RUN_INTEGRATION)("PostgreSQL persistence integration", () => {
  let sql: Sql;
  let persons: PgPersonRepository;
  let profiles: PgAthleteProfileRepository;
  let sports: PgSportDirectory;
  let seededSportId: string;

  beforeAll(async () => {
    sql = postgres(TEST_DB_URL, { max: 4, ssl: "require", onnotice: () => {} }) as Sql;
    persons = new PgPersonRepository(sql);
    profiles = new PgAthleteProfileRepository(sql);
    sports = new PgSportDirectory(sql);
    const rows = await sql<{ id: string }[]>`SELECT id FROM sports LIMIT 1`;
    if (rows[0] === undefined) throw new Error("test database has no seeded sports");
    seededSportId = rows[0].id;
  });

  afterAll(async () => {
    await sql`DELETE FROM athlete_sport_participations WHERE id LIKE ${`${RUN_ID}_%`}`;
    await sql`DELETE FROM athlete_profiles WHERE id LIKE ${`${RUN_ID}_%`}`;
    await sql`DELETE FROM sports_ids WHERE value LIKE ${`${RUN_ID}_%`}`;
    await sql`DELETE FROM persons WHERE id LIKE ${`${RUN_ID}_%`}`;
    await sql.end({ timeout: 5 });
  });

  it("creates Person and Sports ID atomically and reads them back", async () => {
    const created = await persons.create(person("p1", "s1"));
    expect(created.ok).toBe(true);

    const bySports = await persons.findBySportsId(key("s1") as Id<"SportsId">);
    expect(bySports.kind).toBe("found");
    if (bySports.kind !== "found") throw new Error("expected Person");
    expect(bySports.person.id).toBe(key("p1"));
    expect(bySports.person.sportsId?.value).toBe(key("s1"));
    expect(bySports.person.version).toBe(1);

    const byId = await persons.findById(key("p1") as Id<"Person">);
    expect(byId.kind).toBe("found");
    if (byId.kind !== "found") throw new Error("expected Person");
    expect(byId.person.sportsId?.value).toBe(key("s1"));
    expect(byId.person.version).toBe(1);
  });

  it("rejects a duplicate Person ID", async () => {
    const result = await persons.create(person("p1", "s-other"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("duplicate_person_id");
  });

  it("rejects a duplicate public Sports ID", async () => {
    const result = await persons.create(person("p2", "s1"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("duplicate_sports_id");
    const rolledBack = await persons.findById(key("p2") as Id<"Person">);
    expect(rolledBack.kind).toBe("not_found");
  });

  it("deactivates N to the domain-provided N+1 and rejects stale overwrite", async () => {
    const first = await persons.findById(key("p1") as Id<"Person">);
    const stale = await persons.findById(key("p1") as Id<"Person">);
    if (first.kind !== "found" || stale.kind !== "found") throw new Error("expected Person");
    const changed = deactivatePerson(first.person, { now: NOW, eventId: key("event") });
    if (!changed.ok) throw new Error(changed.error.message);
    expect(changed.value.person.version).toBe(2);
    const saved = await persons.save(changed.value.person, first.person.version);
    expect(saved.ok).toBe(true);
    const stored = await sql<{ version: number; lifecycle_status: string }[]>`
      SELECT version, lifecycle_status FROM persons WHERE id = ${key("p1")}`;
    expect(stored[0]).toMatchObject({ version: 2, lifecycle_status: "deactivated" });

    const staleChanged = deactivatePerson(stale.person, { now: NOW, eventId: key("stale-event") });
    if (!staleChanged.ok) throw new Error(staleChanged.error.message);
    const rejected = await persons.save(staleChanged.value.person, stale.person.version);
    expect(rejected).toEqual({ ok: false, error: { kind: "concurrency_conflict" } });
    const after = await sql<{ version: number; lifecycle_status: string }[]>`
      SELECT version, lifecycle_status FROM persons WHERE id = ${key("p1")}`;
    expect(after[0]).toMatchObject({ version: 2, lifecycle_status: "deactivated" });
  });

  it("rejects a non-consecutive domain-provided version without writing", async () => {
    const loaded = await persons.findById(key("p1") as Id<"Person">);
    if (loaded.kind !== "found") throw new Error("expected Person");
    const result = await persons.save({ ...loaded.person, version: 9 as never }, loaded.person.version);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("invalid_persistence_state");
  });

  it("reports a missing Person on lookup and save", async () => {
    const missing = person("missing", "missing-sports");
    const lookup = await persons.findById(missing.id);
    expect(lookup.kind).toBe("not_found");

    const save = await persons.save({ ...missing, version: 2 as never }, missing.version);
    expect(save).toEqual({ ok: false, error: { kind: "not_found" } });
  });

  it("maps a malformed stored Person record to invalid_persistence_state", async () => {
    await sql`INSERT INTO persons (id, display_name, lifecycle_status, version, updated_at)
      VALUES (${key("malformed")}, 'Malformed', 'active', 1, ${NOW})`;
    const result = await persons.findById(key("malformed") as Id<"Person">);
    expect(result.kind).toBe("invalid_persistence_state");
  });

  it("enforces one athlete profile per person", async () => {
    const first = await profiles.create(profile("a1", "p1"));
    expect(first.ok).toBe(true);

    const dup = await profiles.create(profile("a2", "p1"));
    expect(dup.ok).toBe(false);
    if (dup.ok) throw new Error("expected failure");
    expect(dup.error.kind).toBe("person_already_has_profile");
  });

  it("allows only one active participation per sport but permits re-entry", async () => {
    const first = await profiles.addParticipation(
      participation("part1", "a1", seededSportId, "active", null),
    );
    expect(first.ok).toBe(true);

    const conflict = await profiles.addParticipation(
      participation("part2", "a1", seededSportId, "active", null),
    );
    expect(conflict.ok).toBe(false);
    if (conflict.ok) throw new Error("expected failure");
    expect(conflict.error.kind).toBe("already_participating");

    await sql`
      UPDATE athlete_sport_participations
      SET status = 'ended', ended_at = ${NOW}
      WHERE id = ${key("part1")}
    `;

    const reentry = await profiles.addParticipation(
      participation("part3", "a1", seededSportId, "active", null),
    );
    expect(reentry.ok).toBe(true);

    const list = await profiles.listParticipations(key("a1") as Id<"AthleteProfile">);
    expect(list).toHaveLength(2);
    expect(list.filter((p) => p.status === "active")).toHaveLength(1);
  });

  it("reports sport existence through the directory", async () => {
    expect(await sports.exists(seededSportId as Id<"Sport">)).toBe(true);
    expect(await sports.exists("does-not-exist" as Id<"Sport">)).toBe(false);
  });
});
