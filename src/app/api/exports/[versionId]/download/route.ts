import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportPdfPath } from "@/lib/pdf";
import { reportPptxPath } from "@/lib/pptx";

export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{versionId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);
  const {versionId}=await params;if(!z.uuid().safeParse(versionId).success)return apiError("Ugyldig rapport");
  const format=new URL(request.url).searchParams.get("format");
  if(format!=="pdf"&&format!=="pptx")return apiError("Ugyldig filformat");
  // RLS protects this read. The service client is used only after access is confirmed.
  const {data:snapshot,error}=await auth.supabase.from("publication_snapshots").select("version_id").eq("version_id",versionId).maybeSingle();
  if(error||!snapshot)return apiError("Rapport finnes ikke eller du mangler tilgang",404);
  if(format==="pdf"){
    const {data:job}=await auth.supabase.from("exports").select("status,object_path").eq("version_id",versionId).eq("kind","report_pdf").maybeSingle();
    if(job?.status!=="ready"||job.object_path!==reportPdfPath(versionId))return apiError("PDF er ikke klar",409);
  }
  const path=format==="pdf"?reportPdfPath(versionId):reportPptxPath(versionId);
  const {data,error:fileError}=await createAdminClient().storage.from("report-exports").download(path);
  if(fileError||!data)return apiError("Filen finnes ikke",404);
  const body=Buffer.from(await data.arrayBuffer());
  return new Response(body,{headers:{"Content-Type":format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.presentationml.presentation","Content-Disposition":`attachment; filename="driftssjekk-${versionId}.${format}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
