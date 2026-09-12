import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { PgOrganizationRepository } from "@adapters/persistence/pg/pg-organization-repository";
import type { Sql } from "@adapters/persistence/pg/connection";
import { createOrganization } from "@domain/organization/organization";
import type { Organization } from "@domain/organization/organization.types";
import type { Id, ISODateString } from "@shared/kernel";
const URL = process.env.TEST_DATABASE_URL ?? ""; const RUN = URL.trim().length > 0; const PREFIX = `org_it_${Date.now()}_${Math.floor(Math.random()*1e6)}`; const NOW = "2026-09-11T00:00:00.000Z" as ISODateString; const key = (s:string) => `${PREFIX}-${s}`;
function org(id:string, slug:string): Organization { const result = createOrganization({ organizationId:key(id) as Id<"Organization">, name:"International Club", slug:key(slug), type:"club", countryCode:"US", now:NOW, eventId:"evt" }); if(!result.ok) throw new Error(); return result.value.organization; }
describe.skipIf(!RUN)("PostgreSQL Organization persistence", () => {
  let sql:Sql; let repository:PgOrganizationRepository;
  beforeAll(() => { sql=postgres(URL,{max:2,ssl:"require",onnotice:()=>{}}) as Sql; repository=new PgOrganizationRepository(sql); });
  afterAll(async()=>{ await sql`DELETE FROM organizations WHERE id LIKE ${`${PREFIX}%`}`; await sql.end({timeout:5}); });
  it("migration table supports create/read round trip", async()=>{ const value=org("one","one"); expect((await repository.create(value)).ok).toBe(true); expect(await repository.findById(value.id)).toMatchObject({kind:"found",organization:{slug:value.slug,version:1}}); expect(await repository.findBySlug(value.slug)).toMatchObject({kind:"found",organization:{id:value.id}}); });
  it("maps unique slug", async()=>{ await repository.create(org("two","dup")); expect(await repository.create(org("three","dup"))).toMatchObject({ok:false,error:{kind:"duplicate_slug"}}); });
  it.each([["type","bad"],["status","trusted"],["version",0]])("enforces %s constraint", async(column,value)=>{ const id=key(`bad-${column}`); await expect(sql.unsafe(`INSERT INTO organizations (id,name,slug,type,status,country_code,version,created_at,updated_at) VALUES ($1,'Bad',$2,$3,$4,'US',$5,$6,$6)`,[id,id,column==="type"?value:"club",column==="status"?value:"active",column==="version"?value:1,NOW])).rejects.toMatchObject({code:"23514"}); });
  it("rejects invalid persisted state during mapping", async()=>{ const value=org("mapping","mapping"); await repository.create(value); await sql`ALTER TABLE organizations DROP CONSTRAINT organizations_country_code_check`; try { await sql`UPDATE organizations SET country_code='USA' WHERE id=${value.id}`; expect(await repository.findById(value.id)).toMatchObject({kind:"invalid_persistence_state"}); await sql`DELETE FROM organizations WHERE id=${value.id}`; } finally { await sql`ALTER TABLE organizations ADD CONSTRAINT organizations_country_code_check CHECK (country_code ~ '^[A-Z]{2}$')`; } });
  it("has RLS enabled with no policies", async()=>{ const r=await sql<{rowsecurity:boolean,policies:number}[]>`SELECT c.relrowsecurity AS rowsecurity,(SELECT count(*)::int FROM pg_policies p WHERE p.schemaname='public' AND p.tablename='organizations') AS policies FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='organizations'`; expect(r[0]).toEqual({rowsecurity:true,policies:0}); });
});
