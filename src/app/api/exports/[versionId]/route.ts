import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
export async function GET(_request:Request,{params}:{params:Promise<{versionId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);const {versionId}=await params;if(!z.uuid().safeParse(versionId).success)return apiError("Ugyldig rapport");
  const {data:job}=await auth.supabase.from("exports").select("status,object_path,error").eq("version_id",versionId).eq("kind","report_pdf").maybeSingle();
  if(!job)return apiError("PDF finnes ikke",404);
  if(job.status!=="ready"||!job.object_path)return NextResponse.json({status:job.status,error:job.error},{status:202});
  const {data,error}=await auth.supabase.storage.from("report-exports").createSignedUrl(job.object_path,300,{download:true});
  if(error||!data)return apiError("Kunne ikke åpne PDF",500);
  return NextResponse.json({status:"ready",url:data.signedUrl});
}
