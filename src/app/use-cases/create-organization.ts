import type { AppError, Clock, DomainEventPublisher, IdGenerator, OrganizationRepository, UseCase } from "@app/contracts";
import { createOrganization, validateOrganizationDetails } from "@domain/organization/organization";
import type { Organization } from "@domain/organization/organization.types";
import type { Result } from "@shared/kernel";
export interface CreateOrganizationInput { readonly name: string; readonly slug: string; readonly type: string; readonly countryCode: string; }
export interface CreateOrganizationOutput { readonly organization: Organization; }
export interface CreateOrganizationError extends AppError { readonly kind: "invalid_input" | "duplicate_slug" | "duplicate_organization_id" | "persistence_unavailable"; }
export interface CreateOrganizationDeps { readonly clock: Clock; readonly idGenerator: IdGenerator; readonly organizationRepository: OrganizationRepository; readonly domainEvents: DomainEventPublisher; }
export class CreateOrganization implements UseCase<CreateOrganizationInput, CreateOrganizationOutput> {
  constructor(private readonly deps: CreateOrganizationDeps) {}
  async execute(input: CreateOrganizationInput): Promise<Result<CreateOrganizationOutput, CreateOrganizationError>> {
    const validated = validateOrganizationDetails(input); if (!validated.ok) return failure("invalid_input", validated.error.message);
    const existing = await this.deps.organizationRepository.findBySlug(validated.value.slug);
    if (existing.kind === "found") return failure("duplicate_slug", "Organization slug is already in use.");
    if (existing.kind === "unavailable" || existing.kind === "invalid_persistence_state") return failure("persistence_unavailable", "Organization storage is currently unavailable.");
    const built = createOrganization({ organizationId: this.deps.idGenerator.next("Organization"), ...validated.value, now: this.deps.clock.now(), eventId: this.deps.idGenerator.next("DomainEvent") });
    if (!built.ok) return failure("invalid_input", built.error.message);
    const persisted = await this.deps.organizationRepository.create(built.value.organization);
    if (!persisted.ok) { if (persisted.error.kind === "duplicate_slug") return failure("duplicate_slug", "Organization slug is already in use."); if (persisted.error.kind === "duplicate_organization_id") return failure("duplicate_organization_id", "Organization identifier is already in use."); return failure("persistence_unavailable", "Organization storage is currently unavailable."); }
    await this.deps.domainEvents.publish(built.value.event); return { ok: true, value: { organization: persisted.value } };
  }
}
function failure(kind: CreateOrganizationError["kind"], message: string): Result<never, CreateOrganizationError> { return { ok: false, error: { kind, code: kind, message } }; }
