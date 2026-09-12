import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import type { Sql } from "@adapters/persistence/pg/connection";
import { PgOrganizationBootstrapRepository } from "@adapters/persistence/pg/pg-organization-bootstrap-repository";
import { PgOrganizationMembershipRepository } from "@adapters/persistence/pg/pg-organization-membership-repository";
import {
  PgOrganizationRoleRepository,
  PgOrganizationRoleAssignmentRepository,
} from "@adapters/persistence/pg/pg-organization-authorization-repositories";
import { AuthorizeOrganizationPermission } from "@app/use-cases/authorize-organization-permission";
import { ORGANIZATION_PERMISSIONS } from "@domain/organization/organization-authorization.types";
import type { Id, ISODateString } from "@shared/kernel";
const URL = process.env.TEST_DATABASE_URL ?? "",
  RUN = URL.length > 0,
  P = `bootstrap-${Date.now()}`,
  NOW = "2026-09-13T00:00:00Z" as ISODateString,
  org = `${P}-org`,
  p1 = `${P}-p1`,
  p2 = `${P}-p2`;
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
function command(person: string, suffix: string) {
  return {
    organizationId: org as Id<"Organization">,
    personId: person as Id<"Person">,
    membershipId: `${P}-m-${suffix}` as Id<"OrganizationMembership">,
    roleId: `${P}-r-${suffix}` as Id<"OrganizationRole">,
    assignmentId: `${P}-a-${suffix}` as Id<"OrganizationRoleAssignment">,
    now: NOW,
  };
}
describe.skipIf(!RUN)("PostgreSQL Organization bootstrap", () => {
  let sql: Sql, repo: PgOrganizationBootstrapRepository;
  beforeAll(async () => {
    sql = postgres(URL, { ssl: "require", max: 8, onnotice: () => {} }) as Sql;
    repo = new PgOrganizationBootstrapRepository(sql);
    await sql`ALTER TABLE organization_roles ALTER COLUMN role_kind SET DEFAULT 'custom'`;
    await sql`INSERT INTO organizations(id,name,slug,type,status,country_code,version,created_at,updated_at) VALUES(${org},'Bootstrap Org',${org},'club','active','US',1,${NOW},${NOW})`;
    for (const p of [p1, p2]) {
      await sql`INSERT INTO persons(id,display_name,lifecycle_status,version,updated_at) VALUES(${p},'Person','active',1,${NOW})`;
      await sql`INSERT INTO sports_ids(value,person_id,issued_at,status) VALUES(${`${p}-sid`},${p},${NOW},'active')`;
    }
  });
  afterAll(async () => {
    await clear();
    await sql`DELETE FROM sports_ids WHERE person_id IN (${p1},${p2})`;
    await sql`DELETE FROM persons WHERE id IN (${p1},${p2})`;
    await sql`DELETE FROM organizations WHERE id=${org}`;
    await sql.end({ timeout: 5 });
  });
  async function clear() {
    await sql`DELETE FROM organization_role_assignments WHERE organization_id=${org}`;
    await sql`DELETE FROM organization_roles WHERE organization_id=${org}`;
    await sql`DELETE FROM organization_memberships WHERE organization_id=${org}`;
  }
  it("creates the exact system graph, authorizes every permission, and replays idempotently", async () => {
    const first = await repo.bootstrap(command(p1, "first"));
    expect(first).toMatchObject({
      ok: true,
      value: {
        established: true,
        membershipVersion: 1,
        roleVersion: 1,
        assignmentVersion: 1,
      },
    });
    expect(await repo.bootstrap(command(p1, "replay"))).toMatchObject({
      ok: true,
      value: {
        established: false,
        membershipVersion: 1,
        roleVersion: 1,
        assignmentVersion: 1,
      },
    });
    const counts = await sql<
      { members: number; roles: number; assignments: number }[]
    >`SELECT (SELECT count(*)::int FROM organization_memberships WHERE organization_id=${org}) members,(SELECT count(*)::int FROM organization_roles WHERE organization_id=${org}) roles,(SELECT count(*)::int FROM organization_role_assignments WHERE organization_id=${org}) assignments`;
    expect(counts[0]).toEqual({ members: 1, roles: 1, assignments: 1 });
    const role = await sql<
      { key: string; role_kind: string; permissions: string[] }[]
    >`SELECT key,role_kind,permissions FROM organization_roles WHERE organization_id=${org}`;
    expect(role[0]).toEqual({
      key: "organization-admin",
      role_kind: "system",
      permissions: [...ORGANIZATION_PERMISSIONS].sort(),
    });
    if (!first.ok) throw Error();
    const auth = new AuthorizeOrganizationPermission({
      membershipRepository: new PgOrganizationMembershipRepository(sql),
      roleRepository: new PgOrganizationRoleRepository(sql),
      assignmentRepository: new PgOrganizationRoleAssignmentRepository(sql),
    });
    for (const permission of ORGANIZATION_PERMISSIONS)
      expect(
        await auth.execute({
          organizationId: org,
          membershipId: first.value.membershipId,
          permission,
        }),
      ).toMatchObject({ ok: true, value: { allowed: true } });
    expect(await repo.bootstrap(command(p2, "other"))).toMatchObject({
      ok: false,
      error: { kind: "bootstrap_already_established" },
    });
  });
  it("reactivates inactive membership and assignment", async () => {
    const ids = await repo.bootstrap(command(p1, "existing"));
    if (!ids.ok) throw Error();
    await sql`UPDATE organization_memberships SET status='inactive' WHERE id=${ids.value.membershipId}`;
    await sql`UPDATE organization_role_assignments SET status='inactive' WHERE id=${ids.value.assignmentId}`;
    expect(await repo.bootstrap(command(p1, "reactivate"))).toMatchObject({
      ok: true,
      value: { established: true, membershipVersion: 2, assignmentVersion: 2 },
    });
  });
  it("rejects duplicate Organization-local keys while allowing distinct system-role keys", async () => {
    await clear();
    await sql`INSERT INTO organization_roles(id,organization_id,name,key,role_kind,permissions,status,version,created_at,updated_at) VALUES(${`${P}-r-admin`},${org},'Organization Administrator','organization-admin','system',${sql.array([...ORGANIZATION_PERMISSIONS])},'active',1,${NOW},${NOW})`;
    await expect(
      sql`INSERT INTO organization_roles(id,organization_id,name,key,role_kind,permissions,status,version,created_at,updated_at) VALUES(${`${P}-r-admin-duplicate`},${org},'Duplicate Organization Administrator','organization-admin','system',${sql.array([...ORGANIZATION_PERMISSIONS])},'active',1,${NOW},${NOW})`,
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      sql`INSERT INTO organization_roles(id,organization_id,name,key,role_kind,permissions,status,version,created_at,updated_at) VALUES(${`${P}-r-auditor`},${org},'Organization Auditor','organization-auditor','system',${sql.array(["organization.read"])},'active',1,${NOW},${NOW})`,
    ).resolves.toBeDefined();
    const roles = await sql<{ key: string }[]>`SELECT key FROM organization_roles WHERE organization_id=${org} AND role_kind='system' ORDER BY key`;
    expect(roles).toEqual([
      { key: "organization-admin" },
      { key: "organization-auditor" },
    ]);
  });
  it("serializes same- and different-Person races to one graph and one winner", async () => {
    await clear();
    const same = await Promise.all([
      repo.bootstrap(command(p1, "s1")),
      repo.bootstrap(command(p1, "s2")),
    ]);
    expect(same.every((x) => x.ok)).toBe(true);
    await clear();
    const different = await Promise.all([
      repo.bootstrap(command(p1, "d1")),
      repo.bootstrap(command(p2, "d2")),
    ]);
    expect(different.filter((x) => x.ok)).toHaveLength(1);
    expect(different.filter((x) => !x.ok)[0]).toMatchObject({
      error: { kind: "bootstrap_already_established" },
    });
    const rows = await sql<
      { roles: number; assignments: number }[]
    >`SELECT (SELECT count(*)::int FROM organization_roles WHERE organization_id=${org} AND key='organization-admin') roles,(SELECT count(*)::int FROM organization_role_assignments WHERE organization_id=${org}) assignments`;
    expect(rows[0]).toEqual({ roles: 1, assignments: 1 });
  });
  it("rolls back membership and role when assignment persistence fails", async () => {
    await clear();
    const rejected = `${P}-a-rollback`;
    await sql.unsafe(
      `ALTER TABLE organization_role_assignments ADD CONSTRAINT bootstrap_test_forced_failure CHECK (id <> '${rejected}')`,
    );
    try {
      expect(await repo.bootstrap(command(p1, "rollback"))).toMatchObject({
        ok: false,
        error: { kind: "unavailable" },
      });
    } finally {
      await sql`ALTER TABLE organization_role_assignments DROP CONSTRAINT bootstrap_test_forced_failure`;
    }
    const rows = await sql<
      { members: number; roles: number; assignments: number }[]
    >`SELECT (SELECT count(*)::int FROM organization_memberships WHERE organization_id=${org}) members,(SELECT count(*)::int FROM organization_roles WHERE organization_id=${org}) roles,(SELECT count(*)::int FROM organization_role_assignments WHERE organization_id=${org}) assignments`;
    expect(rows[0]).toEqual({ members: 0, roles: 0, assignments: 0 });
  });
  it("types missing prerequisites and rejects a conflicting persisted bootstrap role", async () => {
    expect(await repo.bootstrap(command(`${P}-missing`, "missing-person"))).toMatchObject({ok:false,error:{kind:"person_not_found"}});
    expect(await repo.bootstrap({...command(p1,"missing-org"),organizationId:`${P}-missing-org` as Id<"Organization">})).toMatchObject({ok:false,error:{kind:"organization_not_found"}});
    await sql`INSERT INTO organization_roles(id,organization_id,name,key,role_kind,permissions,status,version,created_at,updated_at) VALUES(${`${P}-conflict`},${org},'Conflicting',${"organization-admin"},'custom',${sql.array(["organization.read"])},'active',1,${NOW},${NOW})`;
    expect(await repo.bootstrap(command(p1,"conflict"))).toMatchObject({ok:false,error:{kind:"invalid_persistence_state"}});
  });
});
