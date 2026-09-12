import { SystemClock } from "@adapters/clock/system-clock";
import { UuidIdGenerator } from "@adapters/id/uuid-id-generator";
import { NoopEventPublisher } from "@adapters/events/noop-event-publisher";
import { createSql,readPgConfigFromEnv } from "@adapters/persistence/pg/connection";
import { PgOrganizationBootstrapRepository } from "@adapters/persistence/pg/pg-organization-bootstrap-repository";
import type { BootstrapPrincipalType,OrganizationBootstrapPrincipalValidator,TrustedOrganizationBootstrapper } from "@app/contracts";
import { BootstrapOrganizationAdministrator } from "@app/use-cases/bootstrap-organization-administrator";

/** Internal composition only. No HTTP, function, RPC, or presentation boundary imports this runtime. */
export function createTrustedOrganizationBootstrapRuntime(env:Record<string,string|undefined>,identity:{readonly type:BootstrapPrincipalType;readonly subject:string}){
  if(!["system","admin"].includes(identity.type)||!identity.subject.trim()||identity.subject.length>200)throw new Error("Trusted Organization bootstrap configuration is invalid.");
  const issued=new WeakSet<object>();
  const principal={...identity} as TrustedOrganizationBootstrapper;issued.add(principal);
  const principalValidator:OrganizationBootstrapPrincipalValidator={isValid:value=>typeof value==="object"&&value!==null&&issued.has(value)};
  const sql=createSql(readPgConfigFromEnv(env)),repository=new PgOrganizationBootstrapRepository(sql);
  return {sql,repository,principal,bootstrapOrganizationAdministrator:new BootstrapOrganizationAdministrator({repository,principalValidator,idGenerator:new UuidIdGenerator(),clock:new SystemClock(),integrationEvents:new NoopEventPublisher()})};
}
