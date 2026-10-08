import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient,apiError,rpcError } from "@/lib/api";
export async function PATCH(request:Request,{params}:{params:Promise<{versionId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);const {versionId}=await params;if(!z.uuid().safeParse(versionId).success)return apiError("Ugyldig rapport");
  const parsed=z.discriminatedUnion("operation",[
    z.object({operation:z.literal("archive"),archived:z.boolean()}),
    z.object({operation:z.literal("withdraw"),reason:z.string().trim().min(5).max(2000)}),
  ]).safeParse(await request.json().catch(()=>null));if(!parsed.success)return apiError("Ugyldig handling");
  const {data:report}=await auth.supabase.from("reports").select("event_id").eq("id",versionId).maybeSingle();
  if(!report)return apiError("Rapporten finnes ikke",404);
  if(report.event_id)return apiError("Samlingsvurderinger kan ikke arkiveres eller trekkes tilbake",400);
  const {error}=parsed.data.operation==="archive"?await auth.supabase.rpc("set_report_archived",{p_report:versionId,p_archived:parsed.data.archived}):await auth.supabase.rpc("withdraw_report",{p_report:versionId,p_reason:parsed.data.reason});
  if(error)return apiError(error.message,rpcError(error.message));return NextResponse.json({ok:true});
}
