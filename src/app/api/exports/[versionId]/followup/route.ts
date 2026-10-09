import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildFollowupPdf, type FollowupTask } from "@/lib/followup-pdf";
import { reportKindLabel } from "@/lib/report-kind";

export const runtime="nodejs";
export const maxDuration=60;
// Built on every download so it shows the current status of each task, unlike the locked report exports.
export async function GET(_request:Request,{params}:{params:Promise<{versionId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);
  const {versionId}=await params;if(!z.uuid().safeParse(versionId).success)return apiError("Ugyldig rapport");
  // Every read below goes through RLS. The service client only downloads images whose rows were readable.
  const {data:version}=await auth.supabase.from("report_versions").select("report_id,visit_date,state").eq("id",versionId).maybeSingle();
  if(!version||version.state!=="published")return apiError("Rapport finnes ikke eller du mangler tilgang",404);
  const {data:report}=await auth.supabase.from("reports").select("id,kind,event_id,store_id,cooperative_id").eq("id",version.report_id).maybeSingle();
  if(!report)return apiError("Rapport finnes ikke eller du mangler tilgang",404);
  const [{data:store},{data:cooperative},{data:actions}]=await Promise.all([
    auth.supabase.from("stores").select("name").eq("id",report.store_id).maybeSingle(),
    auth.supabase.from("cooperatives").select("name").eq("id",report.cooperative_id).maybeSingle(),
    auth.supabase.from("actions").select("id,area_key,description,status,due_date,created_at").eq("report_id",report.id),
  ]);
  const actionIds=(actions||[]).map((action)=>action.id);
  const [{data:updates},{data:images}]=actionIds.length?await Promise.all([
    auth.supabase.from("action_updates").select("id,action_id,actor_id,comment,new_status,created_at").in("action_id",actionIds).order("created_at"),
    auth.supabase.from("action_images").select("action_id,update_id,object_path,caption,created_at").in("action_id",actionIds).order("created_at"),
  ]):[{data:[]},{data:[]}];
  const actorIds=[...new Set((updates||[]).map((update)=>update.actor_id))];
  const {data:profiles}=actorIds.length?await auth.supabase.from("profiles").select("id,display_name").in("id",actorIds):{data:[]};
  const author=(id:string)=>id===auth.userId?"Du":profiles?.find((profile)=>profile.id===id)?.display_name||"Bruker";
  const photos=(actionId:string,updateId:string|null)=>(images||[]).filter((image)=>image.action_id===actionId&&image.update_id===updateId).map((image)=>({path:image.object_path,caption:image.caption}));
  const tasks:FollowupTask[]=(actions||[]).map((action)=>({
    areaKey:action.area_key,description:action.description,status:action.status,dueDate:action.due_date,createdAt:action.created_at,
    images:photos(action.id,null),
    updates:(updates||[]).filter((update)=>update.action_id===action.id).map((update)=>({author:author(update.actor_id),createdAt:update.created_at,status:update.new_status,comment:update.comment,images:photos(action.id,update.id)})),
  }));
  try{
    const bytes=await buildFollowupPdf({storeName:store?.name||"Varehus",cooperativeName:cooperative?.name||"Samvirkelag",reportLabel:reportKindLabel(report.kind,report.event_id),visitDate:version.visit_date,generatedAt:new Date().toISOString(),tasks},createAdminClient());
    return new Response(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="driftssjekk-oppfolging-${versionId}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch{return apiError("Kunne ikke lage oppfølgingsrapporten. Prøv igjen.",500);}
}
