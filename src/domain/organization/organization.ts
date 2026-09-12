import { INITIAL_AGGREGATE_VERSION } from "@domain/aggregate";
import type { OrganizationCreated } from "@domain/organization/organization.events";
import { ORGANIZATION_TYPES } from "@domain/organization/organization.types";
import type { Organization, OrganizationStatus, OrganizationType } from "@domain/organization/organization.types";
import { Result } from "@shared/kernel";
import type { DomainError, Id, ISODateString, Result as ResultType } from "@shared/kernel";
const MAX_NAME = 200; const MAX_SLUG = 100;
export interface NewOrganizationInput { readonly organizationId: Id<"Organization">; readonly name: string; readonly slug: string; readonly type: string; readonly countryCode: string; readonly now: ISODateString; readonly eventId: string; }
export function normalizeOrganizationSlug(value: string): string { return value.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/-+/g, "-"); }
export function validateOrganizationDetails(input: Pick<NewOrganizationInput, "name" | "slug" | "type" | "countryCode">): ResultType<{ name: string; slug: string; type: OrganizationType; countryCode: string }, DomainError> {
  const name = input.name.trim().replace(/\s+/g, " "); const slug = normalizeOrganizationSlug(input.slug); const countryCode = input.countryCode.trim().toUpperCase();
  if (name.length === 0 || name.length > MAX_NAME) return invalid("invalid_name", `Name must contain 1 to ${MAX_NAME} characters.`);
  if (slug.length === 0 || slug.length > MAX_SLUG || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return invalid("invalid_slug", "Slug must contain lowercase letters, numbers, and single hyphens only.");
  if (!ORGANIZATION_TYPES.includes(input.type as OrganizationType)) return invalid("invalid_type", "Organization type is not supported.");
  if (!/^[A-Z]{2}$/.test(countryCode)) return invalid("invalid_country_code", "Country code must be a two-letter ISO-style code.");
  return Result.ok({ name, slug, type: input.type as OrganizationType, countryCode });
}
export function createOrganization(input: NewOrganizationInput): ResultType<{ organization: Organization; event: OrganizationCreated }, DomainError> {
  const details = validateOrganizationDetails(input); if (!details.ok) return details;
  const { name, slug, type, countryCode } = details.value;
  const organization: Organization = { id: input.organizationId, name, slug, type, status: "active", countryCode, createdAt: input.now, updatedAt: input.now, version: INITIAL_AGGREGATE_VERSION };
  const event: OrganizationCreated = { type: "organization.organization_created", eventId: input.eventId, occurredAt: input.now, aggregateId: input.organizationId, aggregateType: "Organization", organizationId: input.organizationId, slug, organizationType: organization.type, countryCode };
  return Result.ok({ organization, event });
}
export function isValidOrganizationState(value: Organization): boolean { return value.id.length > 0 && value.name.trim().length > 0 && value.name.length <= MAX_NAME && value.slug.length <= MAX_SLUG && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) && ORGANIZATION_TYPES.includes(value.type) && (["active", "inactive"] as OrganizationStatus[]).includes(value.status) && /^[A-Z]{2}$/.test(value.countryCode) && Number.isInteger(value.version) && value.version >= 1 && !Number.isNaN(Date.parse(value.createdAt)) && !Number.isNaN(Date.parse(value.updatedAt)); }
function invalid(code: string, message: string): ResultType<never, DomainError> { return Result.fail({ code, message }); }
