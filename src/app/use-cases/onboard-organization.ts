import type { AppError, Clock, IdGenerator, IntegrationEventPublisher, OrganizationOnboardingPrincipalValidator, OrganizationOnboardingRepository, TrustedOrganizationOnboarder, UseCase } from "@app/contracts";
import { createOrganization, validateOrganizationDetails } from "@domain/organization/organization";
import type { Organization } from "@domain/organization/organization.types";
import type { Result } from "@shared/kernel";

export interface OnboardOrganizationInput { readonly onboardingRequestKey: string; readonly name: string; readonly slug: string; readonly type: string; readonly countryCode: string; readonly initialAdministratorPersonId: string; readonly principal: TrustedOrganizationOnboarder; }
export interface OnboardOrganizationOutput { readonly organization: Organization; readonly membershipId: string; readonly roleId: string; readonly assignmentId: string; readonly replayed: boolean; }
export interface OnboardOrganizationError extends AppError { readonly kind: "invalid_input" | "invalid_trusted_principal" | "person_not_found" | "organization_slug_conflict" | "bootstrap_conflict" | "persistence_unavailable" | "invalid_persistence_state" | "concurrency_conflict"; }
export class OnboardOrganization implements UseCase<OnboardOrganizationInput, OnboardOrganizationOutput> {
  constructor(private readonly deps: { repository: OrganizationOnboardingRepository; principalValidator: OrganizationOnboardingPrincipalValidator; idGenerator: IdGenerator; clock: Clock; integrationEvents: IntegrationEventPublisher }) {}
  async execute(input: OnboardOrganizationInput): Promise<Result<OnboardOrganizationOutput, OnboardOrganizationError>> {
    if (!this.deps.principalValidator.isValid(input.principal)) return failure("invalid_trusted_principal", "A trusted Organization onboarding capability is required.");
    const requestKey = input.onboardingRequestKey.trim(), personId = input.initialAdministratorPersonId.trim();
    if (!requestKey || requestKey.length > 200 || !personId) return failure("invalid_input", "A bounded onboarding request key and initial administrator Person are required.");
    const details = validateOrganizationDetails(input); if (!details.ok) return failure("invalid_input", details.error.message);
    const now = this.deps.clock.now();
    const built = createOrganization({ organizationId: this.deps.idGenerator.next("Organization"), ...details.value, now, eventId: this.deps.idGenerator.next("DomainEvent") });
    if (!built.ok) return failure("invalid_input", built.error.message);
    const result = await this.deps.repository.onboard({ onboardingRequestKey: requestKey, organization: built.value.organization, initialAdministratorPersonId: personId as never, membershipId: this.deps.idGenerator.next("OrganizationMembership"), roleId: this.deps.idGenerator.next("OrganizationRole"), assignmentId: this.deps.idGenerator.next("OrganizationRoleAssignment"), now });
    if (!result.ok) return failure(result.error.kind === "unavailable" ? "persistence_unavailable" : result.error.kind, "Organization onboarding could not be completed.");
    if (!result.value.replayed) await this.deps.integrationEvents.publish({ eventId: this.deps.idGenerator.next("IntegrationEvent"), occurredAt: this.deps.clock.now(), eventType: "organization.organization_onboarded", source: "organization", version: 1, payload: { organizationId: result.value.organization.id, membershipId: result.value.bootstrap.membershipId, roleId: result.value.bootstrap.roleId, assignmentId: result.value.bootstrap.assignmentId, principal: { type: input.principal.type, subject: input.principal.subject } } });
    return { ok: true, value: { organization: result.value.organization, membershipId: result.value.bootstrap.membershipId, roleId: result.value.bootstrap.roleId, assignmentId: result.value.bootstrap.assignmentId, replayed: result.value.replayed } };
  }
}
function failure(kind: OnboardOrganizationError["kind"], message: string): Result<never, OnboardOrganizationError> { return { ok: false, error: { kind, code: kind, message } }; }
