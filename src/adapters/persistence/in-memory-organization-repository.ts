import type { OrganizationLookupResult, OrganizationPersistenceError, OrganizationRepository } from "@app/contracts/organization-repository";
import { isValidOrganizationState } from "@domain/organization/organization";
import type { Organization } from "@domain/organization/organization.types";
import type { Id, Result } from "@shared/kernel";
export class InMemoryOrganizationRepository implements OrganizationRepository {
  private readonly byId = new Map<string, Organization>(); private readonly idBySlug = new Map<string, string>();
  async create(value: Organization): Promise<Result<Organization, OrganizationPersistenceError>> { if (value.version !== 1 || !isValidOrganizationState(value)) return bad("A new Organization must be valid at version 1."); if (this.byId.has(value.id)) return fail("duplicate_organization_id"); if (this.idBySlug.has(value.slug)) return fail("duplicate_slug"); const stored = { ...value }; this.byId.set(value.id, stored); this.idBySlug.set(value.slug, value.id); return { ok: true, value: { ...stored } }; }
  async findById(id: Id<"Organization">): Promise<OrganizationLookupResult> { return this.lookup(this.byId.get(id)); }
  async findBySlug(slug: string): Promise<OrganizationLookupResult> { const id = this.idBySlug.get(slug); return this.lookup(id === undefined ? undefined : this.byId.get(id)); }
  get size(): number { return this.byId.size; }
  private lookup(value: Organization | undefined): OrganizationLookupResult { return value === undefined ? { kind: "not_found" } : { kind: "found", organization: { ...value } }; }
}
function fail(kind: "duplicate_organization_id" | "duplicate_slug"): Result<never, OrganizationPersistenceError> { return { ok: false, error: { kind } }; }
function bad(detail: string): Result<never, OrganizationPersistenceError> { return { ok: false, error: { kind: "invalid_persistence_state", detail } }; }
