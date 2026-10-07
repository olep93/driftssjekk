import { createClient } from "@supabase/supabase-js";
export function createAdminClient(){
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!secret)throw new Error("Secret-nøkkel mangler");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,secret,{auth:{autoRefreshToken:false,persistSession:false}});
}
