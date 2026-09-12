import type { Organization } from "@domain/organization/organization.types";
import type { Id, ISODateString, Result } from "@shared/kernel";
import type { OrganizationBootstrapGraph } from "@app/contracts/organization-bootstrap-repository";

export interface OrganizationOnboardingCommand {
  readonly onboardingRequestKey: string;
  readonly organization: Organization;
  readonly initialAdministratorPersonId: Id<"Person">;
  readonly membershipId: Id<"OrganizationMembership">;
  readonly roleId: Id<"OrganizationRole">;
  readonly assignmentId: Id<"OrganizationRoleAssignment">;
  readonly now: ISODateString;
}
export interface OrganizationOnboardingResult { readonly organization: Organization; readonly bootstrap: OrganizationBootstrapGraph; readonly replayed: boolean; }
export type OrganizationOnboardingPersistenceError = { kind: "person_not_found" | "organization_slug_conflict" | "bootstrap_conflict" | "invalid_persistence_state" | "concurrency_conflict" | "unavailable"; detail?: string };
export interface OrganizationOnboardingRepository { onboard(command: OrganizationOnboardingCommand): Promise<Result<OrganizationOnboardingResult, OrganizationOnboardingPersistenceError>>; }
