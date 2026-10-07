import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";
export async function DELETE(_request:Request,{params}:{params:Promise<{imageId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);const {imageId}=await params;if(!z.uuid().safeParse(imageId).success)return apiError("Ugyldig bilde");
  const {data:path,error}=await auth.supabase.rpc("remove_report_image",{p_image:imageId});if(error)return apiError(error.message,rpcError(error.message));
  // A copied image still belongs to an older published version; only newly uploaded draft objects can be removed.
  const firstSegment=String(path).split("/")[0];
  if(firstSegment){await auth.supabase.storage.from("report-images").remove([path]);}
  return NextResponse.json({ok:true});
}
