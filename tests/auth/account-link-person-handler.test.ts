/* global Request */
import {describe,expect,it,vi} from "vitest";
import {createAccountLinkPersonHandler} from "@adapters/http/account-link-person-handler";
import type {LinkAuthenticatedAccountErrorKind} from "@app/use-cases/link-authenticated-account-to-existing-person";
const credential="v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const request=(body:unknown={claimCredential:credential},headers:Record<string,string>={Authorization:"Bearer caller-token","Content-Type":"application/json"},method="POST")=>new Request("https://example.test/account/link-person",{method,headers,body:method==="POST"?JSON.stringify(body):undefined});
function handler(outcome:unknown={ok:true,value:{account:{}}},close=vi.fn(async()=>{})){return{close,handle:createAccountLinkPersonHandler(()=>({close,linkPerson:{execute:vi.fn(async()=>outcome)} as never}))};}
async function response(outcome:unknown){const result=await handler(outcome).handle(request());return{status:result.status,body:await result.json() as {code:string;message:string}};}
describe("POST /account/link-person transport",()=>{
 it("rejects a missing Authorization header",async()=>expect((await handler().handle(request({}, {"Content-Type":"application/json"}))).status).toBe(401));
 it("rejects malformed Authorization",async()=>expect((await handler().handle(request({}, {Authorization:"Basic nope","Content-Type":"application/json"}))).status).toBe(401));
 it("allows only POST",async()=>{const result=await handler().handle(request(undefined,{Authorization:"Bearer token"},"GET"));expect(result.status).toBe(405);expect(result.headers.get("allow")).toBe("POST");});
 it("requires JSON",async()=>expect((await handler().handle(request({}, {Authorization:"Bearer token","Content-Type":"text/plain"}))).status).toBe(415));
 it("rejects malformed JSON",async()=>expect((await handler().handle(new Request("https://example.test",{method:"POST",headers:{Authorization:"Bearer token","Content-Type":"application/json"},body:"{"}))).status).toBe(400));
 it("rejects oversized bodies before execution",async()=>expect((await handler().handle(request({claimCredential:"x".repeat(9000)}))).status).toBe(413));
 it("does not accept a Person ID or any second field",async()=>expect((await handler().handle(request({claimCredential:credential,personId:"attacker"}))).status).toBe(400));
 it("returns minimal success JSON and closes request resources",async()=>{const state=handler(),result=await state.handle(request());expect(result.status).toBe(200);expect(await result.json()).toEqual({code:"linked",message:"Account linked."});expect(state.close).toHaveBeenCalledOnce();});
 it.each([["authenticated_subject_required",401],["identity_provider_unavailable",503],["persistence_unavailable",503],["auth_subject_already_linked",409],["person_already_linked",409],["consumed_claim",409],["expired_claim",400],["revoked_claim",400],["invalid_claim",400]] as const)("maps %s safely",async(kind,status)=>expect(await response({ok:false,error:{kind,code:kind,message:"internal detail"}})).toMatchObject({status,body:{message:expect.not.stringContaining("internal detail")}}));
 it("does not leak unexpected errors or credentials",async()=>{const handle=createAccountLinkPersonHandler(()=>{throw new Error(`secret ${credential}`)}),result=await handle(request());expect(result.status).toBe(500);expect(await result.text()).not.toContain(credential);});
 it("never reflects bearer or claim tokens",async()=>{const result=await handler({ok:false,error:{kind:"invalid_claim" as LinkAuthenticatedAccountErrorKind}}).handle(request());const text=await result.text();expect(text).not.toContain("caller-token");expect(text).not.toContain(credential);});
});
