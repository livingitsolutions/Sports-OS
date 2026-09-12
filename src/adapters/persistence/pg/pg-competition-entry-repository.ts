import type {
  CompetitionEntryLookup,
  CompetitionEntryPersistenceError,
  CompetitionEntryRepository,
} from "@app/contracts/competition-entry-repository";
import type { Sql } from "@adapters/persistence/pg/connection";
import {
  isForeignKeyViolation,
  isUniqueViolation,
  neutralDetail,
  pgErrorInfo,
} from "@adapters/persistence/pg/errors";
import type { AggregateVersion } from "@domain/aggregate";
import type { CompetitionEntry } from "@domain/competition/competition-entry.types";
import type { Id, ISODateString, Result } from "@shared/kernel";
type Row = Record<string, unknown>;
const iso = (x: unknown) =>
  (x instanceof Date
    ? x.toISOString()
    : new Date(String(x)).toISOString()) as ISODateString;
const map = (r: Row): CompetitionEntry => ({
  id: r.id as Id<"CompetitionEntry">,
  competitionId: r.competition_id as Id<"Competition">,
  divisionId: r.division_id as Id<"Division"> | null,
  entrantType: r.entrant_type as CompetitionEntry["entrantType"],
  athleteProfileId: r.athlete_profile_id as Id<"AthleteProfile"> | null,
  teamId: r.team_id as Id<"Team"> | null,
  status: r.status as CompetitionEntry["status"],
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
  version: Number(r.version) as AggregateVersion,
});
const bad = (
  kind: CompetitionEntryPersistenceError["kind"],
  detail?: string,
): Result<never, CompetitionEntryPersistenceError> => ({
  ok: false,
  error: { kind, ...(detail ? { detail } : {}) },
});
function failure(e: unknown) {
  const i = pgErrorInfo(e);
  if (isUniqueViolation(i))
    return bad(
      i?.constraint.includes("active_") ? "already_active" : "duplicate_id",
    );
  if (isForeignKeyViolation(i)) return bad("parent_not_found");
  return bad("unavailable", neutralDetail(e));
}
const lookup = (rows: Row[]): CompetitionEntryLookup =>
  rows[0]
    ? { kind: "found", competitionEntry: map(rows[0]) }
    : { kind: "not_found" };
export class PgCompetitionEntryRepository implements CompetitionEntryRepository {
  constructor(private readonly sql: Sql) {}
  async listActiveForCompetition(c:Id<"Competition">){try{return{ok:true as const,value:(await this.sql<Row[]>`SELECT * FROM competition_entries WHERE competition_id=${c} AND status='active' ORDER BY id`).map(map)}}catch(e){return failure(e)}}
  async listActiveForDivision(c:Id<"Competition">,d:Id<"Division">){try{return{ok:true as const,value:(await this.sql<Row[]>`SELECT * FROM competition_entries WHERE competition_id=${c} AND division_id=${d} AND status='active' ORDER BY id`).map(map)}}catch(e){return failure(e)}}
  async countActiveForCompetition(c: Id<"Competition">) { try { const [r]=await this.sql<Row[]>`SELECT count(*)::integer AS count FROM competition_entries WHERE competition_id=${c} AND status='active'`; return {ok:true as const,value:Number(r?.count??0)}; } catch(e) { return failure(e); } }
  async countActiveForDivision(c: Id<"Competition">,d: Id<"Division">) { try { const [r]=await this.sql<Row[]>`SELECT count(*)::integer AS count FROM competition_entries WHERE competition_id=${c} AND division_id=${d} AND status='active'`; return {ok:true as const,value:Number(r?.count??0)}; } catch(e) { return failure(e); } }
  async create(x: CompetitionEntry) {
    try {
      await this
        .sql`INSERT INTO competition_entries(id,competition_id,division_id,entrant_type,athlete_profile_id,team_id,status,created_at,updated_at,version) VALUES(${x.id},${x.competitionId},${x.divisionId},${x.entrantType},${x.athleteProfileId},${x.teamId},${x.status},${x.createdAt},${x.updatedAt},${x.version})`;
      return { ok: true as const, value: x };
    } catch (e) {
      return failure(e);
    }
  }
  async save(x: CompetitionEntry, v: number) {
    try {
      const rows = await this.sql<
        Row[]
      >`UPDATE competition_entries SET status=${x.status},updated_at=${x.updatedAt},version=${x.version} WHERE id=${x.id} AND version=${v} AND ${x.version}=${v}+1 RETURNING *`;
      return rows[0]
        ? { ok: true as const, value: map(rows[0]) }
        : bad("concurrency_conflict");
    } catch (e) {
      return failure(e);
    }
  }
  async findById(id: Id<"CompetitionEntry">) {
    return lookup(
      await this.sql<Row[]>`SELECT * FROM competition_entries WHERE id=${id}`,
    );
  }
  async findActiveAthleteEntry(c: Id<"Competition">, a: Id<"AthleteProfile">) {
    return lookup(
      await this.sql<
        Row[]
      >`SELECT * FROM competition_entries WHERE competition_id=${c} AND athlete_profile_id=${a} AND entrant_type='athlete' AND status='active' LIMIT 1`,
    );
  }
  async findActiveTeamEntry(c: Id<"Competition">, t: Id<"Team">) {
    return lookup(
      await this.sql<
        Row[]
      >`SELECT * FROM competition_entries WHERE competition_id=${c} AND team_id=${t} AND entrant_type='team' AND status='active' LIMIT 1`,
    );
  }
}
