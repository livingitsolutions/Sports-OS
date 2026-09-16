import type {Config} from "@netlify/functions";
import {createProductionContainer} from "../../src/composition/production.ts";

const response=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"private, no-store"}});
export default async(request:Request)=>{
 const url=new URL(request.url);const competitionFormatId=url.searchParams.get("competitionFormatId")?.trim();const actingMembershipId=url.searchParams.get("actingMembershipId")?.trim();
 if(!competitionFormatId||!actingMembershipId)return response(400,{message:"Tournament context is required."});
 try{const result=await createProductionContainer().useCases.getTournamentOperationsView.execute({competitionFormatId,actingMembershipId});if(result.ok)return response(200,result.value.view);const status=result.error.kind==="forbidden"?403:result.error.kind==="unsupported_operations_format"?422:result.error.kind==="not_found"?404:503;return response(status,{message:status===403?"Access not available.":status===422?"Format not supported.":status===404?"Tournament not found.":"Tournament temporarily unavailable."});}catch{return response(503,{message:"Tournament temporarily unavailable."});}
};
export const config:Config={path:"/.netlify/functions/tournament-operations",method:"GET"};
