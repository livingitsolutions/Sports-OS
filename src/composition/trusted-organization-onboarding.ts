import { SystemClock } from "@adapters/clock/system-clock";
import { NoopEventPublisher } from "@adapters/events/noop-event-publisher";
import { UuidIdGenerator } from "@adapters/id/uuid-id-generator";
import { createSql, readPgConfigFromEnv } from "@adapters/persistence/pg/connection";
import { PgOrganizationOnboardingRepository } from "@adapters/persistence/pg/pg-organization-onboarding-repository";
import type { OnboardingPrincipalType, OrganizationOnboardingPrincipalValidator, TrustedOrganizationOnboarder } from "@app/contracts";
import { OnboardOrganization } from "@app/use-cases/onboard-organization";

/** Trusted composition seam only; never construct this identity from request data. */
export function issueTrustedOrganizationOnboardingCapability(identity:{readonly type:OnboardingPrincipalType;readonly subject:string}){
  if(!["system","admin"].includes(identity.type)||!identity.subject.trim()||identity.subject.length>200)throw new Error("Trusted Organization onboarding configuration is invalid.");
  const issued=new WeakSet<object>(),principal={...identity} as TrustedOrganizationOnboarder;issued.add(principal);
  const principalValidator:OrganizationOnboardingPrincipalValidator={isValid:value=>typeof value==="object"&&value!==null&&issued.has(value)};
  return {principal,principalValidator};
}
/** Internal/test composition only. No HTTP, Function, RPC, or UI imports this runtime. */
export function createTrustedOrganizationOnboardingRuntime(env:Record<string,string|undefined>,identity:{readonly type:OnboardingPrincipalType;readonly subject:string}){
  const capability=issueTrustedOrganizationOnboardingCapability(identity),sql=createSql(readPgConfigFromEnv(env)),repository=new PgOrganizationOnboardingRepository(sql);
  return {sql,repository,principal:capability.principal,onboardOrganization:new OnboardOrganization({repository,principalValidator:capability.principalValidator,idGenerator:new UuidIdGenerator(),clock:new SystemClock(),integrationEvents:new NoopEventPublisher()})};
}
