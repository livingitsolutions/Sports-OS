import { describe,expect,it } from "vitest";
import { InMemoryOrganizationTrustRepository } from "@adapters";
import { createOrganizationTrust,isOrganizationTrustEffectiveAt,revokeOrganizationTrust } from "@domain/organization/organization-trust";
import type { Id,ISODateString } from "@shared/kernel";

const NOW="2026-09-15T10:00:00.000Z" as ISODateString;
const A="org-a" as Id<"Organization">,B="org-b" as Id<"Organization">;
function make(id:string,issuer=A,subject=B,scope="organizer.verified",expiresAt?:ISODateString){return createOrganizationTrust({trustId:id as Id<"OrganizationTrust">,issuerOrganizationId:issuer,subjectOrganizationId:subject,scope,...(expiresAt?{expiresAt}:{}),now:NOW,eventId:`event-${id}`});}

describe("OrganizationTrust",()=>{
  it("rejects self trust, unknown scopes, and non-future expiry",()=>{
    expect(make("self",A,A)).toMatchObject({ok:false,error:{code:"self_trust"}});
    expect(make("scope",A,B,"anything")).toMatchObject({ok:false,error:{code:"invalid_scope"}});
    expect(make("expiry",A,B,"organizer.verified","2026-09-15T09:00:00.000Z" as ISODateString)).toMatchObject({ok:false,error:{code:"invalid_expiry"}});
  });
  it("is effective directly until expiry and revocation",()=>{
    const value=make("one",A,B,"organizer.verified","2026-09-15T11:00:00.000Z" as ISODateString);if(!value.ok)throw Error();
    expect(isOrganizationTrustEffectiveAt(value.value.trust,NOW)).toBe(true);
    expect(isOrganizationTrustEffectiveAt(value.value.trust,"2026-09-15T11:00:00.000Z" as ISODateString)).toBe(false);
    const revoked=revokeOrganizationTrust(value.value.trust,{now:"2026-09-15T10:30:00.000Z" as ISODateString,eventId:"revoked"});
    expect(revoked).toMatchObject({ok:true,value:{trust:{status:"revoked",version:2,issuedAt:NOW},event:{type:"organization.trust_revoked"}}});
    if(!revoked.ok)throw Error();expect(isOrganizationTrustEffectiveAt(revoked.value.trust,NOW)).toBe(false);
  });
  it("retains history, rejects duplicate effective grants, and permits reissue after revoke or expiry",async()=>{
    const repo=new InMemoryOrganizationTrustRepository();const first=make("one");if(!first.ok)throw Error();
    expect(await repo.create(first.value.trust)).toMatchObject({ok:true});
    const duplicate=make("two");if(!duplicate.ok)throw Error();expect(await repo.create(duplicate.value.trust)).toMatchObject({ok:false,error:{kind:"duplicate_effective_trust"}});
    const revoked=revokeOrganizationTrust(first.value.trust,{now:NOW,eventId:"r"});if(!revoked.ok)throw Error();await repo.save(revoked.value.trust,1);
    expect(await repo.create(duplicate.value.trust)).toMatchObject({ok:true});
    const expiring=make("expired",A,"org-c" as Id<"Organization">,"organizer.verified","2026-09-15T10:01:00.000Z" as ISODateString);if(!expiring.ok)throw Error();await repo.create(expiring.value.trust);
    const later=createOrganizationTrust({trustId:"later" as Id<"OrganizationTrust">,issuerOrganizationId:A,subjectOrganizationId:"org-c" as Id<"Organization">,scope:"organizer.verified",now:"2026-09-15T10:02:00.000Z" as ISODateString,eventId:"later"});if(!later.ok)throw Error();expect(await repo.create(later.value.trust)).toMatchObject({ok:true});
  });
});
