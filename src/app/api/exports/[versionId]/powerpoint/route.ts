import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReportPptx } from "@/lib/pptx";

export const runtime="nodejs";
export const maxDuration=60;
// Built on each download instead of stored: a deck is about as large as the report's photos.
export async function POST(_request:Request,{params}:{params:Promise<{versionId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);
  const {versionId}=await params;if(!z.uuid().safeParse(versionId).success)return apiError("Ugyldig rapport");
  // The snapshot read is subject to RLS. Only readers of the published version can export it.
  const {data:snapshot,error}=await auth.supabase.from("publication_snapshots").select("content").eq("version_id",versionId).maybeSingle();
  if(error||!snapshot)return apiError("Rapport finnes ikke eller du mangler tilgang",404);
  try{
    const bytes=await buildReportPptx(snapshot.content as Parameters<typeof buildReportPptx>[0],createAdminClient());
    return new Response(Buffer.from(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.presentationml.presentation","Content-Disposition":`attachment; filename="driftssjekk-${versionId}.pptx"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch{return apiError("Kunne ikke lage PowerPoint. Prøv igjen.",500);}
}
