import type { Config } from "@netlify/functions";
import { createAccountLinkPersonHandler } from "../../src/adapters/http/account-link-person-handler.ts";
import { createAccountLinkRequestRuntime } from "../../src/composition/account-link-request.ts";

declare const Netlify:{readonly env:{get(name:string):string|undefined}};
export default (request:Request)=>{const names=["SUPABASE_URL","SUPABASE_ANON_KEY","CLAIM_HASH_ACTIVE_VERSION","CLAIM_HASH_KEYS","DATABASE_URL","SUPABASE_DB_URL"] as const;return createAccountLinkPersonHandler(authorization=>createAccountLinkRequestRuntime(Object.fromEntries(names.map(name=>[name,Netlify.env.get(name)])),authorization))(request);};
export const config:Config={path:"/account/link-person",method:"POST"};
