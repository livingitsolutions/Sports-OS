import type {Config} from "@netlify/functions";
import {createOrganizerContextHandler} from "../../src/adapters/http/organizer-context-handler.ts";
import {createOrganizerRequestRuntime} from "../../src/composition/organizer-request.ts";
declare const Netlify:{readonly env:{get(name:string):string|undefined}};
const env=()=>Object.fromEntries(["SUPABASE_URL","SUPABASE_ANON_KEY","DATABASE_URL","SUPABASE_DB_URL"].map(name=>[name,Netlify.env.get(name)]));
export default (request:Request)=>createOrganizerContextHandler(authorization=>createOrganizerRequestRuntime(env(),authorization))(request);
export const config:Config={path:"/.netlify/functions/organizer-context",method:"GET"};
