import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";
const captionSchema = z.object({caption:z.string().max(1000),expectedCaption:z.string().max(1000)});
export async function PATCH(request:Request,{params}:{params:Promise<{imageId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);
  const {imageId}=await params;if(!z.uuid().safeParse(imageId).success)return apiError("Ugyldig bilde");
  const parsed=captionSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return apiError("Bildeteksten kan være maks 1000 tegn.");
  const {data,error}=await auth.supabase.rpc("update_report_image_caption",{
    p_image:imageId,p_caption:parsed.data.caption.trim(),p_expected_caption:parsed.data.expectedCaption,
  });
  if(error)return apiError(error.message,rpcError(error.message));
  return NextResponse.json({caption:data});
}
export async function DELETE(_request:Request,{params}:{params:Promise<{imageId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);const {imageId}=await params;if(!z.uuid().safeParse(imageId).success)return apiError("Ugyldig bilde");
  const {data:path,error}=await auth.supabase.rpc("remove_report_image",{p_image:imageId});if(error)return apiError(error.message,rpcError(error.message));
  // A copied image still belongs to an older published version; only newly uploaded draft objects can be removed.
  const firstSegment=String(path).split("/")[0];
  if(firstSegment){await auth.supabase.storage.from("report-images").remove([path]);}
  return NextResponse.json({ok:true});
}
