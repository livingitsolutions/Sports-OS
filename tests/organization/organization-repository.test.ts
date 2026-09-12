import { describe, expect, it } from "vitest";
import { InMemoryOrganizationRepository } from "@adapters/persistence/in-memory-organization-repository";
import { createOrganization } from "@domain/organization/organization";
import type { Organization } from "@domain/organization/organization.types";
import type { Id, ISODateString } from "@shared/kernel";
const NOW = "2026-09-11T00:00:00.000Z" as ISODateString;
function org(id: string, slug: string): Organization { const result = createOrganization({ organizationId: id as Id<"Organization">, name: "Example", slug, type: "club", countryCode: "US", now: NOW, eventId: "evt" }); if (!result.ok) throw new Error(); return result.value.organization; }
describe("InMemoryOrganizationRepository", () => {
  it("creates and reads by id and slug", async () => { const repo = new InMemoryOrganizationRepository(); expect((await repo.create(org("o1", "one"))).ok).toBe(true); expect(await repo.findById("o1" as Id<"Organization">)).toMatchObject({ kind: "found", organization: { slug: "one", version: 1 } }); expect(await repo.findBySlug("one")).toMatchObject({ kind: "found", organization: { id: "o1" } }); });
  it("rejects duplicate id", async () => { const repo = new InMemoryOrganizationRepository(); await repo.create(org("o1", "one")); expect(await repo.create(org("o1", "two"))).toMatchObject({ ok: false, error: { kind: "duplicate_organization_id" } }); });
  it("rejects duplicate slug", async () => { const repo = new InMemoryOrganizationRepository(); await repo.create(org("o1", "one")); expect(await repo.create(org("o2", "one"))).toMatchObject({ ok: false, error: { kind: "duplicate_slug" } }); });
  it("rejects a non-initial persistence version", async () => { const repo = new InMemoryOrganizationRepository(); expect(await repo.create({ ...org("o1", "one"), version: 2 as never })).toMatchObject({ ok: false, error: { kind: "invalid_persistence_state" } }); });
});
