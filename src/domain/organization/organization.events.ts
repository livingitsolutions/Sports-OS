import type { DomainEvent } from "@domain/aggregate";
import type { OrganizationType } from "@domain/organization/organization.types";
import type { Id } from "@shared/kernel";
export interface OrganizationCreated extends DomainEvent { readonly type: "organization.organization_created"; readonly aggregateType: "Organization"; readonly organizationId: Id<"Organization">; readonly slug: string; readonly organizationType: OrganizationType; readonly countryCode: string; }
