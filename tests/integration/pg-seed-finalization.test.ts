import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  FakeClock,
  FakeIdGenerator,
  InMemoryEventPublisher,
  PgCompetitionEntryRepository,
  PgCompetitionFormatRepository,
  PgCompetitionRepository,
  PgCompetitionSeedAssignmentRepository,
  PgCompetitionSeedFinalizer,
  PgCompetitionStructureMaterializer,
  PgDivisionRepository,
  PgEventRepository,
} from "@adapters";
import type { Sql } from "@adapters";
import { FinalizeCompetitionSeedAssignments } from "@app/use-cases/finalize-competition-seed-assignments";
import { MaterializeCompetitionFormatPlan } from "@app/use-cases/materialize-competition-format-plan";
import type { AuthorizeOrganizationPermission } from "@app/use-cases/authorize-organization-permission";
import { createCompetitionFormat } from "@domain/competition/competition-format";
import { createCompetitionSeedAssignment } from "@domain/competition/competition-seed-assignment";
import { createCompetitionFormatEngineRegistry } from "@composition/competition-format-engines";
import type { CompetitionFormat } from "@domain/competition/competition-format";
import type { Id, ISODateString } from "@shared/kernel";

const URL = process.env.TEST_DATABASE_URL ?? "",
  RUN = URL.length > 0,
  P = `final-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  NOW = "2026-09-23T10:00:00.000Z" as ISODateString,
  LATER = "2026-09-23T11:00:00.000Z" as ISODateString;
const id = <T extends string>(suffix: string) => `${P}-${suffix}` as Id<T>;
const auth = {
  execute: async () => ({ ok: true as const, value: { allowed: true } }),
} as unknown as AuthorizeOrganizationPermission;

describe.skipIf(!RUN)("PostgreSQL seed finalization", () => {
  let sql: Sql;
  beforeAll(async () => {
    sql = postgres(URL, { ssl: "require", max: 12, onnotice: () => {} }) as Sql;
    await sql`INSERT INTO organizations(id,name,slug,type,status,country_code,version,created_at,updated_at) VALUES(${id<"Organization">("org")},'Finalization Org',${P},'club','active','US',1,${NOW},${NOW})`;
    await sql`INSERT INTO events(id,organization_id,name,key,status,created_at,updated_at,version) VALUES(${id<"Event">("event")},${id<"Organization">("org")},'Finalization Event',${P},'draft',${NOW},${NOW},1)`;
  });
  afterAll(async () => {
    await sql`DELETE FROM competition_seed_assignments WHERE competition_format_id LIKE ${`${P}%`}`;
    await sql`DELETE FROM contests WHERE stage_id IN (SELECT id FROM competition_stages WHERE competition_id LIKE ${`${P}%`})`;
    await sql`DELETE FROM competition_stages WHERE competition_id LIKE ${`${P}%`}`;
    await sql`DELETE FROM competition_format_materializations WHERE competition_format_id LIKE ${`${P}%`}`;
    await sql`DELETE FROM competition_entries WHERE competition_id LIKE ${`${P}%`}`;
    await sql`DELETE FROM competition_formats WHERE competition_id LIKE ${`${P}%`}`;
    await sql`DELETE FROM competitions WHERE id LIKE ${`${P}%`}`;
    await sql`DELETE FROM teams WHERE organization_id=${id<"Organization">("org")}`;
    await sql`DELETE FROM events WHERE id=${id<"Event">("event")}`;
    await sql`DELETE FROM organizations WHERE id=${id<"Organization">("org")}`;
    await sql.end({ timeout: 5 });
  });

  async function fixture(suffix: string) {
    const competitionId = id<"Competition">(`${suffix}-competition`);
    await sql`INSERT INTO competitions(id,event_id,sport_id,name,key,status,created_at,updated_at,version) VALUES(${competitionId},${id<"Event">("event")},'sport-basketball',${`Competition ${suffix}`},${suffix.replaceAll("-", "")},'draft',${NOW},${NOW},1)`;
    for (let n = 1; n <= 7; n++) {
      await sql`INSERT INTO teams(id,organization_id,sport_id,name,key,status,created_at,updated_at,version) VALUES(${id<"Team">(`${suffix}-team-${n}`)},${id<"Organization">("org")},'sport-basketball',${`${suffix} Team ${n}`},${`${suffix.replaceAll("-", "")}-team-${n}`},'active',${NOW},${NOW},1)`;
      if (n <= 6)
        await sql`INSERT INTO competition_entries(id,competition_id,entrant_type,team_id,status,created_at,updated_at,version) VALUES(${id<"CompetitionEntry">(`${suffix}-entry-${n}`)},${competitionId},'team',${id<"Team">(`${suffix}-team-${n}`)},'active',${NOW},${NOW},1)`;
    }
    const made = createCompetitionFormat({
      id: id<"CompetitionFormat">(`${suffix}-format`),
      competitionId,
      kind: "single_elimination",
      now: NOW,
      domainEventId: `${P}-event`,
    });
    if (!made.ok) throw Error();
    const format = made.value.format;
    await new PgCompetitionFormatRepository(sql).create(format);
    const materialize = new MaterializeCompetitionFormatPlan({
      competitionFormatRepository: new PgCompetitionFormatRepository(sql),
      competitionRepository: new PgCompetitionRepository(sql),
      divisionRepository: new PgDivisionRepository(sql),
      eventRepository: new PgEventRepository(sql),
      competitionEntryRepository: new PgCompetitionEntryRepository(sql),
      materializer: new PgCompetitionStructureMaterializer(sql),
      engines: createCompetitionFormatEngineRegistry(),
      authorization: auth,
      clock: new FakeClock(NOW),
      idGenerator: new FakeIdGenerator(`${P}-${suffix}`),
      domainEvents: new InMemoryEventPublisher(),
    });
    expect(
      await materialize.execute({
        actingMembershipId: "membership",
        competitionFormatId: format.id,
      }),
    ).toMatchObject({ ok: true, value: { stageCount: 3, contestCount: 5 } });
    return format;
  }
  const assignment = (
    format: CompetitionFormat,
    entry: number,
    seed: number,
  ) => {
    const made = createCompetitionSeedAssignment({
      id: randomUUID() as Id<"CompetitionSeedAssignment">,
      competitionFormatId: format.id,
      competitionEntryId: id<"CompetitionEntry">(
        `${format.id.slice(P.length + 1, -7)}-entry-${entry}`,
      ),
      seedNumber: seed,
      now: NOW,
    });
    if (!made.ok) throw Error();
    return made.value;
  };
  async function seedAll(format: CompetitionFormat, count = 6) {
    const repo = new PgCompetitionSeedAssignmentRepository(sql);
    for (let n = 1; n <= count; n++)
      expect((await repo.create(assignment(format, n, n))).ok).toBe(true);
  }
  function finalize(format: CompetitionFormat, at: ISODateString = NOW) {
    return new FinalizeCompetitionSeedAssignments({
      competitionFormatRepository: new PgCompetitionFormatRepository(sql),
      competitionRepository: new PgCompetitionRepository(sql),
      divisionRepository: new PgDivisionRepository(sql),
      eventRepository: new PgEventRepository(sql),
      competitionEntryRepository: new PgCompetitionEntryRepository(sql),
      assignmentRepository: new PgCompetitionSeedAssignmentRepository(sql),
      materializer: new PgCompetitionStructureMaterializer(sql),
      finalizer: new PgCompetitionSeedFinalizer(sql),
      engines: createCompetitionFormatEngineRegistry(),
      authorization: auth,
      clock: new FakeClock(at),
      idGenerator: new FakeIdGenerator(`${P}-finalize`),
      domainEvents: new InMemoryEventPublisher(),
    });
  }
  async function snapshot(format: CompetitionFormat) {
    return sql<
      { competition_entry_id: string; seed_number: number }[]
    >`SELECT competition_entry_id,seed_number FROM competition_seed_assignments WHERE competition_format_id=${format.id} ORDER BY seed_number`;
  }

  it("materializes and finalizes a complete six-entry bracket without participants", async () => {
    const format = await fixture("happy-");
    const [marker] = await sql<
      { entrant_count: number; seed_finalized_at: unknown }[]
    >`SELECT entrant_count,seed_finalized_at FROM competition_format_materializations WHERE competition_format_id=${format.id}`;
    expect(marker).toEqual({ entrant_count: 6, seed_finalized_at: null });
    expect(
      await sql`SELECT id FROM competition_stages WHERE competition_format_id=${format.id}`,
    ).toHaveLength(3);
    expect(
      await sql`SELECT id FROM contests WHERE stage_id IN (SELECT id FROM competition_stages WHERE competition_format_id=${format.id})`,
    ).toHaveLength(5);
    await seedAll(format);
    const before = await snapshot(format);
    expect(before).toHaveLength(6);
    expect(
      await finalize(format).execute({
        actingMembershipId: "membership",
        competitionFormatId: format.id,
      }),
    ).toMatchObject({
      ok: true,
      value: { entrantCount: 6, seedCount: 6, finalizedAt: NOW },
    });
    const [locked] = await sql<
      { seed_finalized_at: Date }[]
    >`SELECT seed_finalized_at FROM competition_format_materializations WHERE competition_format_id=${format.id}`;
    expect(locked?.seed_finalized_at.toISOString()).toBe(NOW);
    expect(await snapshot(format)).toEqual(before);
    const [participantTable] = await sql<
      { table_name: string | null }[]
    >`SELECT to_regclass('public.contest_participants')::text AS table_name`;
    expect(participantTable?.table_name).toBeNull();
    const identityColumns =
      await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='contests' AND column_name IN ('competition_entry_id','athlete_profile_id','team_id')`;
    expect(identityColumns).toHaveLength(0);
    expect(
      await finalize(format, LATER).execute({
        actingMembershipId: "membership",
        competitionFormatId: format.id,
      }),
    ).toMatchObject({ ok: false, error: { kind: "already_finalized" } });
    expect(
      (
        await sql<
          { at: Date }[]
        >`SELECT seed_finalized_at at FROM competition_format_materializations WHERE competition_format_id=${format.id}`
      )[0]?.at.toISOString(),
    ).toBe(NOW);
  });

  it("rejects same-count entry identity drift atomically", async () => {
    const format = await fixture("drift-");
    await seedAll(format);
    const before = await snapshot(format),
      stages =
        await sql`SELECT id FROM competition_stages WHERE competition_format_id=${format.id}`,
      contests =
        await sql`SELECT id FROM contests WHERE stage_id IN (SELECT id FROM competition_stages WHERE competition_format_id=${format.id})`;
    await sql`UPDATE competition_entries SET status='withdrawn',updated_at=${LATER},version=2 WHERE id=${id<"CompetitionEntry">("drift--entry-6")}`;
    await sql`INSERT INTO competition_entries(id,competition_id,entrant_type,team_id,status,created_at,updated_at,version) VALUES(${id<"CompetitionEntry">("drift--entry-7")},${format.competitionId},'team',${id<"Team">("drift--team-7")},'active',${LATER},${LATER},1)`;
    expect(
      (
        await sql<
          { count: number }[]
        >`SELECT count(*)::int count FROM competition_entries WHERE competition_id=${format.competitionId} AND status='active'`
      )[0]?.count,
    ).toBe(6);
    expect(
      await finalize(format).execute({
        actingMembershipId: "membership",
        competitionFormatId: format.id,
      }),
    ).toMatchObject({ ok: false, error: { kind: "entrant_set_changed" } });
    expect(
      (
        await sql`SELECT seed_finalized_at FROM competition_format_materializations WHERE competition_format_id=${format.id}`
      )[0]?.seed_finalized_at,
    ).toBeNull();
    expect(await snapshot(format)).toEqual(before);
    expect(
      await sql`SELECT id FROM competition_stages WHERE competition_format_id=${format.id}`,
    ).toEqual(stages);
    expect(
      await sql`SELECT id FROM contests WHERE stage_id IN (SELECT id FROM competition_stages WHERE competition_format_id=${format.id})`,
    ).toEqual(contests);
  });

  it("makes PostgreSQL authoritative after finalization", async () => {
    const format = await fixture("closed-");
    await seedAll(format);
    expect(
      (
        await finalize(format).execute({
          actingMembershipId: "membership",
          competitionFormatId: format.id,
        })
      ).ok,
    ).toBe(true);
    const before = await snapshot(format);
    expect(
      await new PgCompetitionSeedAssignmentRepository(sql).create(
        assignment(format, 6, 7),
      ),
    ).toMatchObject({ ok: false, error: { kind: "seeding_finalized" } });
    expect(await snapshot(format)).toEqual(before);
    expect(
      (
        await sql<
          { at: Date }[]
        >`SELECT seed_finalized_at at FROM competition_format_materializations WHERE competition_format_id=${format.id}`
      )[0]?.at.toISOString(),
    ).toBe(NOW);
  });

  it("serializes the final assignment against finalization", async () => {
    const format = await fixture("race-");
    await seedAll(format, 5);
    const repo = new PgCompetitionSeedAssignmentRepository(sql),
      finalizer = new PgCompetitionSeedFinalizer(sql),
      expectedEntries = Array.from({ length: 6 }, (_, n) =>
        id<"CompetitionEntry">(`race--entry-${n + 1}`),
      ),
      expectedSeeds = [1, 2, 3, 4, 5, 6];
    const [assigned, finalized] = await Promise.all([
      repo.create(assignment(format, 6, 6)),
      finalizer.finalize({
        competitionFormatId: format.id,
        expectedEntryIds: expectedEntries,
        expectedSeedNumbers: expectedSeeds,
        finalizedAt: NOW,
      }),
    ]);
    expect(assigned.ok).toBe(true);
    expect(finalized.ok || finalized.error.kind === "seeding_incomplete").toBe(
      true,
    );
    const [marker] = await sql<
      { seed_finalized_at: Date | null }[]
    >`SELECT seed_finalized_at FROM competition_format_materializations WHERE competition_format_id=${format.id}`;
    expect(await snapshot(format)).toHaveLength(6);
    if (finalized.ok)
      expect(marker?.seed_finalized_at?.toISOString()).toBe(NOW);
    else expect(marker?.seed_finalized_at).toBeNull();
    if (marker?.seed_finalized_at) {
      expect(
        await repo.create({
          ...assignment(format, 6, 7),
          id: randomUUID() as Id<"CompetitionSeedAssignment">,
        }),
      ).toMatchObject({ ok: false, error: { kind: "seeding_finalized" } });
      expect(await snapshot(format)).toHaveLength(6);
    }
  });

  it("allows exactly one concurrent finalization and preserves its timestamp", async () => {
    const format = await fixture("double-");
    await seedAll(format);
    const before = await snapshot(format),
      a = finalize(format, NOW),
      b = finalize(format, LATER);
    const results = await Promise.all([
      a.execute({
        actingMembershipId: "membership",
        competitionFormatId: format.id,
      }),
      b.execute({
        actingMembershipId: "membership",
        competitionFormatId: format.id,
      }),
    ]);
    expect(results.filter((x) => x.ok)).toHaveLength(1);
    expect(
      results.filter((x) => !x.ok && x.error.kind === "already_finalized"),
    ).toHaveLength(1);
    const successful = results.find((x) => x.ok);
    const [marker] = await sql<
      { at: Date }[]
    >`SELECT seed_finalized_at at FROM competition_format_materializations WHERE competition_format_id=${format.id}`;
    expect(marker?.at.toISOString()).toBe(
      successful?.ok ? successful.value.finalizedAt : undefined,
    );
    expect(await snapshot(format)).toEqual(before);
  });

  it("retains nullable marker schema, RLS, constraints, and zero policies", async () => {
    const [column] = await sql<
      { is_nullable: string; data_type: string }[]
    >`SELECT is_nullable,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='competition_format_materializations' AND column_name='seed_finalized_at'`;
    expect(column).toEqual({
      is_nullable: "YES",
      data_type: "timestamp with time zone",
    });
    const [posture] = await sql<
      { relrowsecurity: boolean; policies: number }[]
    >`SELECT c.relrowsecurity,(SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='competition_format_materializations') policies FROM pg_class c WHERE c.relname='competition_format_materializations'`;
    expect(posture).toEqual({ relrowsecurity: true, policies: 0 });
    const constraints = await sql<
      { constraint_name: string }[]
    >`SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='competition_seed_assignments'`;
    expect(constraints.map((x) => x.constraint_name)).toEqual(
      expect.arrayContaining([
        "competition_seed_assignments_pkey",
        "competition_seed_assignments_format_seed_unique",
        "competition_seed_assignments_format_entry_unique",
        "competition_seed_assignments_competition_format_id_fkey",
        "competition_seed_assignments_competition_entry_id_fkey",
      ]),
    );
  });
});
