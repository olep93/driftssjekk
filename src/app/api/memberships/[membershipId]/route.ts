import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
export async function DELETE(_request:Request,{params}:{params:Promise<{membershipId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);
  const {membershipId}=await params;if(!z.uuid().safeParse(membershipId).success)return apiError("Ugyldig tildeling");
  const admin=createAdminClient();
  const {data:target}=await admin.from("memberships").select("id,user_id,cooperative_id,role").eq("id",membershipId).maybeSingle();if(!target)return apiError("Tildeling finnes ikke",404);
  const {data:mine}=await auth.supabase.from("memberships").select("id").eq("user_id",auth.userId).eq("cooperative_id",target.cooperative_id).eq("role","cooperative_admin").maybeSingle();if(!mine)return apiError("Ingen tilgang",403);
  if(target.user_id===auth.userId)return apiError("Du kan ikke fjerne din egen administratortilgang her");
  const {error}=await admin.from("memberships").delete().eq("id",membershipId);if(error)return apiError(error.message,500);
  await admin.from("audit_events").insert({cooperative_id:target.cooperative_id,actor_id:auth.userId,event_type:"revoked",object_type:"membership",object_id:membershipId,details:{user_id:target.user_id,role:target.role}});
  return NextResponse.json({ok:true});
}
