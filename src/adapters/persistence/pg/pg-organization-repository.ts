import type { OrganizationLookupResult, OrganizationPersistenceError, OrganizationRepository } from "@app/contracts/organization-repository";
import type { Sql } from "@adapters/persistence/pg/connection";
import { isUniqueViolation, neutralDetail, pgErrorInfo } from "@adapters/persistence/pg/errors";
import { toOrganization } from "@adapters/persistence/pg/mappers";
import type { OrganizationRow } from "@adapters/persistence/pg/mappers";
import { isValidOrganizationState } from "@domain/organization/organization";
import type { Organization } from "@domain/organization/organization.types";
import type { Id, Result } from "@shared/kernel";
export class PgOrganizationRepository implements OrganizationRepository {
  constructor(private readonly sql: Sql) {}
  async create(value: Organization): Promise<Result<Organization, OrganizationPersistenceError>> {
    if (value.version !== 1 || !isValidOrganizationState(value)) return { ok: false, error: { kind: "invalid_persistence_state", detail: "A new Organization must be valid at version 1." } };
    try { await this.sql`INSERT INTO organizations (id,name,slug,type,status,country_code,version,created_at,updated_at) VALUES (${value.id},${value.name},${value.slug},${value.type},${value.status},${value.countryCode},${value.version},${value.createdAt},${value.updatedAt})`; return { ok: true, value }; }
    catch (error) { const info = pgErrorInfo(error); if (isUniqueViolation(info) && info !== null) return { ok: false, error: { kind: info.constraint.includes("pkey") ? "duplicate_organization_id" : "duplicate_slug" } }; return { ok: false, error: { kind: "unavailable", detail: neutralDetail(error) } }; }
  }
  findById(id: Id<"Organization">): Promise<OrganizationLookupResult> { return this.read(() => this.sql<OrganizationRow[]>`SELECT id,name,slug,type,status,country_code,version,created_at,updated_at FROM organizations WHERE id=${id} LIMIT 1`); }
  findBySlug(slug: string): Promise<OrganizationLookupResult> { return this.read(() => this.sql<OrganizationRow[]>`SELECT id,name,slug,type,status,country_code,version,created_at,updated_at FROM organizations WHERE slug=${slug} LIMIT 1`); }
  private async read(run: () => Promise<OrganizationRow[]>): Promise<OrganizationLookupResult> { try { const row = (await run())[0]; if (row === undefined) return { kind: "not_found" }; const organization = toOrganization(row); return organization === null ? { kind: "invalid_persistence_state", detail: "Stored Organization violates persistence invariants." } : { kind: "found", organization }; } catch (error) { return { kind: "unavailable", detail: neutralDetail(error) }; } }
}
