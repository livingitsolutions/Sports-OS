import type { DomainEvent } from "@domain/aggregate";import type { OrganizationTrustScope } from "@domain/organization/organization-trust.types";import type { Id,ISODateString } from "@shared/kernel";
interface Base extends DomainEvent{aggregateType:"OrganizationTrust";trustId:Id<"OrganizationTrust">;issuerOrganizationId:Id<"Organization">;subjectOrganizationId:Id<"Organization">;scope:OrganizationTrustScope;}
export interface OrganizationTrustIssued extends Base{type:"organization.trust_issued";issuedAt:ISODateString;expiresAt?:ISODateString;}
export interface OrganizationTrustRevoked extends Base{type:"organization.trust_revoked";revokedAt:ISODateString;}
export type OrganizationTrustEvent=OrganizationTrustIssued|OrganizationTrustRevoked;
