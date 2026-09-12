import type { AggregateRoot,AggregateVersion } from "@domain/aggregate";
import type { Id,ISODateString } from "@shared/kernel";
export const ORGANIZATION_TRUST_SCOPES=["organizer.verified","competition.sanctioning","governing.authority"] as const;
export type OrganizationTrustScope=(typeof ORGANIZATION_TRUST_SCOPES)[number];
export type OrganizationTrustStatus="active"|"revoked";
export interface OrganizationTrust extends AggregateRoot<"OrganizationTrust">{issuerOrganizationId:Id<"Organization">;subjectOrganizationId:Id<"Organization">;scope:OrganizationTrustScope;status:OrganizationTrustStatus;issuedAt:ISODateString;revokedAt?:ISODateString;expiresAt?:ISODateString;createdAt:ISODateString;updatedAt:ISODateString;version:AggregateVersion;}
