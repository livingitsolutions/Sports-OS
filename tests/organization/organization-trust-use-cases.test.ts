import { describe,expect,it } from "vitest";
import { FakeClock,FakeIdGenerator,InMemoryEventPublisher,InMemoryOrganizationTrustRepository } from "@adapters";
import { EvaluateOrganizationTrust,IssueOrganizationTrust,RevokeOrganizationTrust } from "@app/use-cases/organization-trust";
import type { DomainEvent } from "@app/contracts";
import { createOrganizationTrust } from "@domain/organization/organization-trust";
import type { Id,ISODateString } from "@shared/kernel";

const NOW="2026-09-15T10:00:00.000Z" as ISODateString;
const A="a" as Id<"Organization">,B="b" as Id<"Organization">,R="r" as Id<"Organization">;

function setup(allow=true){
  const trustRepository=new InMemoryOrganizationTrustRepository(),clock=new FakeClock(NOW),idGenerator=new FakeIdGenerator("trust"),domainEvents=new InMemoryEventPublisher<DomainEvent>();
  const organizationRepository={findById:async(id:Id<"Organization">)=>[A,B,R].includes(id)?{kind:"found",organization:{}}:{kind:"not_found"}};
  const authorization={execute:async(i:{organizationId:string;membershipId:string})=>({ok:true,value:{allowed:allow&&i.membershipId===`active-${i.organizationId}`}})};
  return {trustRepository,clock,idGenerator,domainEvents,organizationRepository,authorization};
}
function issue(d:ReturnType<typeof setup>){return new IssueOrganizationTrust({...d,organizationRepository:d.organizationRepository as never,authorization:d.authorization as never});}
async function seed(d:ReturnType<typeof setup>,id:string,issuer:Id<"Organization">,subject:Id<"Organization">,expiresAt?:ISODateString){
  const built=createOrganizationTrust({trustId:id as Id<"OrganizationTrust">,issuerOrganizationId:issuer,subjectOrganizationId:subject,scope:"governing.authority",...(expiresAt?{expiresAt}:{}),now:NOW,eventId:`event-${id}`});
  if(!built.ok)throw Error(built.error.message);
  const saved=await d.trustRepository.create(built.value.trust);
  if(!saved.ok)throw Error(saved.error.kind);
  return saved.value;
}

describe("Organization trust application boundary",()=>{
  it("allows an authorized issuer to issue organizer.verified",async()=>{
    expect(await issue(setup()).execute({actingMembershipId:"active-a",issuerOrganizationId:A,subjectOrganizationId:B,scope:"organizer.verified"})).toMatchObject({ok:true,value:{trust:{scope:"organizer.verified"}}});
  });
  it("denies inactive, wrong-Organization, or unauthorized acting membership",async()=>{
    expect(await issue(setup()).execute({actingMembershipId:"inactive",issuerOrganizationId:A,subjectOrganizationId:B,scope:"organizer.verified"})).toMatchObject({ok:false,error:{kind:"forbidden"}});
    expect(await issue(setup(false)).execute({actingMembershipId:"active-a",issuerOrganizationId:A,subjectOrganizationId:B,scope:"organizer.verified"})).toMatchObject({ok:false,error:{kind:"forbidden"}});
  });
  it("requires effective direct incoming governing authority for competition.sanctioning",async()=>{
    const d=setup();
    expect(await issue(d).execute({actingMembershipId:"active-a",issuerOrganizationId:A,subjectOrganizationId:B,scope:"competition.sanctioning"})).toMatchObject({ok:false,error:{kind:"issuer_not_governing_authority"}});
    await seed(d,"root",R,A);
    expect(await issue(d).execute({actingMembershipId:"active-a",issuerOrganizationId:A,subjectOrganizationId:B,scope:"competition.sanctioning"})).toMatchObject({ok:true,value:{trust:{scope:"competition.sanctioning"}}});
  });
  it("never issues governing.authority through normal trust management",async()=>{
    const d=setup();
    await seed(d,"root",R,A);
    expect(await issue(d).execute({actingMembershipId:"active-a",issuerOrganizationId:A,subjectOrganizationId:B,scope:"governing.authority"})).toEqual({ok:false,error:{kind:"governing_authority_issuance_not_permitted",code:"governing_authority_issuance_not_permitted",message:"Governing authority cannot be issued through Organization trust management."}});
    expect(await issue(d).execute({actingMembershipId:"active-r",issuerOrganizationId:R,subjectOrganizationId:B,scope:"governing.authority"})).toMatchObject({ok:false,error:{kind:"governing_authority_issuance_not_permitted"}});
  });
  it("has no role-key or Organization-type bypass for governing authority issuance",async()=>{
    expect(await issue(setup()).execute({actingMembershipId:"active-r",issuerOrganizationId:R,subjectOrganizationId:B,scope:"governing.authority"})).toMatchObject({ok:false,error:{kind:"governing_authority_issuance_not_permitted"}});
  });
  it("evaluates and revokes a seeded direct governing authority without traversal",async()=>{
    const d=setup(),direct=await seed(d,"direct",R,A),evaluate=new EvaluateOrganizationTrust(d);
    expect(await evaluate.execute({issuerOrganizationId:R,subjectOrganizationId:A,scope:"governing.authority"})).toMatchObject({ok:true,value:{effective:true,trust:{id:direct.id}}});
    expect(await evaluate.execute({issuerOrganizationId:R,subjectOrganizationId:B,scope:"governing.authority"})).toEqual({ok:true,value:{effective:false}});
    const revoke=new RevokeOrganizationTrust({...d,authorization:d.authorization as never});
    expect(await revoke.execute({actingMembershipId:"active-r",issuerOrganizationId:R,trustId:direct.id})).toMatchObject({ok:true,value:{trust:{status:"revoked",version:2}}});
    expect(await evaluate.execute({issuerOrganizationId:R,subjectOrganizationId:A,scope:"governing.authority"})).toEqual({ok:true,value:{effective:false}});
  });
  it("treats expired incoming governing authority as ineffective",async()=>{
    const d=setup(),clock=new FakeClock("2026-09-15T11:00:00.000Z" as ISODateString);
    await seed(d,"expired",R,A,"2026-09-15T10:30:00.000Z" as ISODateString);
    expect(await new EvaluateOrganizationTrust({trustRepository:d.trustRepository,clock}).execute({issuerOrganizationId:R,subjectOrganizationId:A,scope:"governing.authority"})).toEqual({ok:true,value:{effective:false}});
    expect(await new IssueOrganizationTrust({...d,clock,organizationRepository:d.organizationRepository as never,authorization:d.authorization as never}).execute({actingMembershipId:"active-a",issuerOrganizationId:A,subjectOrganizationId:B,scope:"competition.sanctioning"})).toMatchObject({ok:false,error:{kind:"issuer_not_governing_authority"}});
  });
});
