import { INITIAL_AGGREGATE_VERSION, nextAggregateVersion } from "@domain/aggregate";
import type { OrganizationMembershipEvent } from "@domain/organization/organization-membership.events";
import type { OrganizationMembership } from "@domain/organization/organization-membership.types";
import { Result } from "@shared/kernel";
import type { DomainError, Id, ISODateString, Result as ResultType } from "@shared/kernel";

interface CreateInput { membershipId: Id<"OrganizationMembership">; organizationId: Id<"Organization">; personId: Id<"Person">; now: ISODateString; eventId: string; }
interface TransitionInput { now: ISODateString; eventId: string; }
export function createOrganizationMembership(input: CreateInput): ResultType<{ membership: OrganizationMembership; event: OrganizationMembershipEvent }, DomainError> {
  if (!input.membershipId.trim() || !input.organizationId.trim() || !input.personId.trim()) return Result.fail(error("required_id", "Membership, Organization, and Person identifiers are required."));
  if (!validDate(input.now)) return Result.fail(error("invalid_timestamp", "A valid timestamp is required."));
  const membership: OrganizationMembership = { id: input.membershipId, organizationId: input.organizationId, personId: input.personId, status: "active", createdAt: input.now, updatedAt: input.now, version: INITIAL_AGGREGATE_VERSION };
  return Result.ok({ membership, event: event("organization.membership_created", membership, input.eventId, input.now) });
}
export function deactivateOrganizationMembership(value: OrganizationMembership, input: TransitionInput): ResultType<{ membership: OrganizationMembership; event: OrganizationMembershipEvent }, DomainError> {
  if (value.status !== "active") return Result.fail(error("membership_not_active", "Only an active membership can be deactivated."));
  return transition(value, "inactive", "organization.membership_deactivated", input);
}
export function reactivateOrganizationMembership(value: OrganizationMembership, input: TransitionInput): ResultType<{ membership: OrganizationMembership; event: OrganizationMembershipEvent }, DomainError> {
  if (value.status !== "inactive") return Result.fail(error("membership_not_inactive", "Only an inactive membership can be reactivated."));
  return transition(value, "active", "organization.membership_reactivated", input);
}
export function isValidOrganizationMembershipState(value: OrganizationMembership): boolean { return Boolean(value.id.trim() && value.organizationId.trim() && value.personId.trim()) && ["active", "inactive"].includes(value.status) && Number.isInteger(value.version) && value.version >= 1 && validDate(value.createdAt) && validDate(value.updatedAt) && Date.parse(value.updatedAt) >= Date.parse(value.createdAt); }
function transition(value: OrganizationMembership, status: "active" | "inactive", type: OrganizationMembershipEvent["type"], input: TransitionInput): ResultType<{ membership: OrganizationMembership; event: OrganizationMembershipEvent }, DomainError> { if (!validDate(input.now) || Date.parse(input.now) < Date.parse(value.updatedAt)) return Result.fail(error("invalid_timestamp", "Transition time cannot precede the current state.")); const membership = { ...value, status, updatedAt: input.now, version: nextAggregateVersion(value.version) }; return Result.ok({ membership, event: event(type, membership, input.eventId, input.now) }); }
function event(type: OrganizationMembershipEvent["type"], value: OrganizationMembership, eventId: string, occurredAt: ISODateString): OrganizationMembershipEvent { return { type, eventId, occurredAt, aggregateId: value.id, aggregateType: "OrganizationMembership", membershipId: value.id, organizationId: value.organizationId, personId: value.personId, aggregateVersion: value.version } as OrganizationMembershipEvent; }
function validDate(value: string): value is ISODateString { return !Number.isNaN(Date.parse(value)); }
function error(code: string, message: string): DomainError { return { code, message }; }
