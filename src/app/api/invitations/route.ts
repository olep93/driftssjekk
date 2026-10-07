import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
const schema=z.object({cooperativeId:z.uuid(),storeId:z.uuid().nullable(),role:z.enum(["operations","store_manager","cooperative_admin"]),email:z.email(),name:z.string().trim().min(2).max(150)});
export async function POST(request:Request){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return apiError("Ugyldige invitasjonsdata");
  const {cooperativeId,storeId,role,email,name}=parsed.data;
  const {data:myRole}=await auth.supabase.from("memberships").select("id").eq("user_id",auth.userId).eq("cooperative_id",cooperativeId).eq("role","cooperative_admin").maybeSingle();
  if(!myRole)return apiError("Ingen tilgang",403);
  if((role==="store_manager")!==Boolean(storeId))return apiError("Varehussjef må ha ett varehus");
  if(storeId){const {data:store}=await auth.supabase.from("stores").select("id").eq("id",storeId).eq("cooperative_id",cooperativeId).maybeSingle();if(!store)return apiError("Ugyldig varehus");}
  try{
    const admin=createAdminClient();
    const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{data:{display_name:name},redirectTo:`${process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin}/auth/callback?next=/nytt-passord`});
    if(error||!data.user)return apiError(error?.message||"Invitasjon feilet");
    const {error:profileError}=await admin.from("profiles").upsert({id:data.user.id,display_name:name});
    if(profileError)return apiError("Brukeren ble invitert, men profil kunne ikke lagres: "+profileError.message,500);
    const {error:membershipError}=await admin.from("memberships").insert({user_id:data.user.id,cooperative_id:cooperativeId,store_id:storeId,role});
    if(membershipError)return apiError("Brukeren ble invitert, men rolle kunne ikke lagres: "+membershipError.message,500);
    await admin.from("audit_events").insert({cooperative_id:cooperativeId,actor_id:auth.userId,event_type:"granted",object_type:"membership",object_id:data.user.id,details:{role,store_id:storeId}});
    return NextResponse.json({ok:true});
  }catch{return apiError("Invitasjon er ikke konfigurert. Kontroller service-nøkkelen.",503);}
}
