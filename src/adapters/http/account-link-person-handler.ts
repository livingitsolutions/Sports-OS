/* global Request, Response, TextEncoder */
import type { LinkAuthenticatedAccountToExistingPerson, LinkAuthenticatedAccountErrorKind } from "@app/use-cases/link-authenticated-account-to-existing-person";
import type { RawClaimToken } from "@app/contracts";

const MAX_BODY_BYTES=8192,MAX_CREDENTIAL_CHARS=256,BEARER=/^Bearer [^\s]{1,4096}$/;
export interface AccountLinkHandlerRuntime { readonly linkPerson:LinkAuthenticatedAccountToExistingPerson; close():Promise<void>; }
export type AccountLinkRuntimeFactory=(authorization:string)=>AccountLinkHandlerRuntime;

export function createAccountLinkPersonHandler(createRuntime:AccountLinkRuntimeFactory){
  return async function handle(request:Request):Promise<Response>{
    if(request.method!=="POST")return json(405,"method_not_allowed","Only POST is allowed.",{"Allow":"POST"});
    const authorization=request.headers.get("authorization");
    if(authorization===null||!BEARER.test(authorization))return json(401,"unauthenticated","Authentication is required.");
    const contentType=request.headers.get("content-type")?.split(";",1)[0]?.trim().toLowerCase();
    if(contentType!=="application/json")return json(415,"invalid_request","Content-Type must be application/json.");
    const declared=Number(request.headers.get("content-length")??"0");
    if(!Number.isFinite(declared)||declared<0||declared>MAX_BODY_BYTES)return json(413,"invalid_request","Request body is too large.");
    let text:string;try{text=await request.text();}catch{return json(400,"invalid_request","Request body is invalid.");}
    if(text.length===0||new TextEncoder().encode(text).length>MAX_BODY_BYTES)return json(text.length===0?400:413,"invalid_request",text.length===0?"Request body is required.":"Request body is too large.");
    let body:unknown;try{body=JSON.parse(text);}catch{return json(400,"invalid_request","Request body must be valid JSON.");}
    if(!isBody(body))return json(400,"invalid_request","Exactly one claimCredential string is required.");
    let runtime:AccountLinkHandlerRuntime|undefined;
    try{
      runtime=createRuntime(authorization);
      const result=await runtime.linkPerson.execute({rawClaimToken:body.claimCredential as RawClaimToken});
      if(result.ok)return json(200,"linked","Account linked.");
      return mapError(result.error.kind);
    }catch{return json(500,"internal_error","The request could not be completed.");}
    finally{if(runtime!==undefined)try{await runtime.close();}catch{/* response remains secret-free */}}
  };
}
function isBody(value:unknown):value is {claimCredential:string}{if(typeof value!=="object"||value===null||Array.isArray(value))return false;const keys=Object.keys(value);const credential=(value as Record<string,unknown>).claimCredential;return keys.length===1&&keys[0]==="claimCredential"&&typeof credential==="string"&&credential.length>0&&credential.length<=MAX_CREDENTIAL_CHARS;}
function mapError(kind:LinkAuthenticatedAccountErrorKind):Response{if(kind==="authenticated_subject_required")return json(401,"unauthenticated","Authentication is required.");if(kind==="identity_provider_unavailable"||kind==="persistence_unavailable")return json(503,"service_unavailable","The service is temporarily unavailable.");if(kind==="auth_subject_already_linked"||kind==="person_already_linked"||kind==="concurrency_conflict")return json(409,"link_conflict","The account or Person is already linked.");if(kind==="consumed_claim")return json(409,"claim_unusable","The claim cannot be used.");if(kind==="invalid_claim"||kind==="expired_claim"||kind==="revoked_claim"||kind==="hash_key_unavailable"||kind==="person_not_found"||kind==="person_not_linkable")return json(400,"claim_unusable","The claim cannot be used.");return json(500,"internal_error","The request could not be completed.");}
function json(status:number,code:string,message:string,extra:Record<string,string>={}):Response{return Response.json({code,message},{status,headers:{"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff",...extra}});}
