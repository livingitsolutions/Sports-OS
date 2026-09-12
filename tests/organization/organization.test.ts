import { describe, expect, it } from "vitest";
import { createOrganization } from "@domain/organization/organization";
import { ORGANIZATION_TYPES } from "@domain/organization/organization.types";
import type { Id, ISODateString } from "@shared/kernel";
const NOW = "2026-09-11T00:00:00.000Z" as ISODateString;
function make(overrides: Partial<Parameters<typeof createOrganization>[0]> = {}) { return createOrganization({ organizationId: "org-1" as Id<"Organization">, name: " Global Sports ", slug: " Global_Sports ", type: "federation", countryCode: " ph ", now: NOW, eventId: "evt-1", ...overrides }); }
describe("Organization", () => {
  it("creates active version 1 and normalizes values", () => { const result = make(); expect(result.ok).toBe(true); if (!result.ok) return; expect(result.value.organization).toMatchObject({ name: "Global Sports", slug: "global-sports", countryCode: "PH", status: "active", version: 1, createdAt: NOW, updatedAt: NOW }); expect(result.value.event.organizationId).toBe("org-1"); });
  it("accepts every supported type", () => { for (const type of ORGANIZATION_TYPES) expect(make({ type }).ok).toBe(true); });
  it.each([{ name: "", code: "invalid_name" }, { slug: "--bad--", code: "invalid_slug" }, { countryCode: "PHL", code: "invalid_country_code" }, { type: "lgu", code: "invalid_type" }])("rejects invalid $code", ({ code, ...values }) => { const result = make(values); expect(result.ok).toBe(false); if (!result.ok) expect(result.error.code).toBe(code); });
  it("owns valid initial status and version", () => { const result = make(); if (!result.ok) throw new Error(); expect(result.value.organization.status).toBe("active"); expect(result.value.organization.version).toBe(1); });
});
