import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReportPptx, reportPptxPath } from "@/lib/pptx";

export const runtime="nodejs";
export const maxDuration=60;
export async function POST(_request:Request,{params}:{params:Promise<{versionId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);
  const {versionId}=await params;if(!z.uuid().safeParse(versionId).success)return apiError("Ugyldig rapport");
  // The snapshot read is subject to RLS. Only readers of the published version can export it.
  const {data:snapshot,error}=await auth.supabase.from("publication_snapshots").select("content").eq("version_id",versionId).maybeSingle();
  if(error||!snapshot)return apiError("Rapport finnes ikke eller du mangler tilgang",404);
  const admin=createAdminClient();const path=reportPptxPath(versionId);
  const existing=await admin.storage.from("report-exports").createSignedUrl(path,300,{download:true});
  if(existing.data?.signedUrl)return NextResponse.json({status:"ready"});
  try{
    const bytes=await buildReportPptx(snapshot.content as Parameters<typeof buildReportPptx>[0],admin);
    const {error:uploadError}=await admin.storage.from("report-exports").upload(path,Buffer.from(bytes),{contentType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",upsert:false});
    if(uploadError&&!/already exists|duplicate/i.test(uploadError.message))throw uploadError;
    return NextResponse.json({status:"ready"});
  }catch{return apiError("Kunne ikke lage PowerPoint. Prøv igjen.",500);}
}
