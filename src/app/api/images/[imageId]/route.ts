import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";
const captionSchema = z.object({caption:z.string().max(1000),expectedCaption:z.string().max(1000)});
const replacementSchema = z.object({
  expectedPath:z.string().min(1).max(500), expectedCaption:z.string().max(1000),
  path:z.string().min(1).max(500), caption:z.string().max(1000), size:z.number().int().min(1).max(10485760),
});
export async function PUT(request:Request,{params}:{params:Promise<{imageId:string}>}){
  const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);
  const {imageId}=await params;if(!z.uuid().safeParse(imageId).success)return apiError("Ugyldig bilde");
  const parsed=replacementSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return apiError("Ugyldige bildedata.");
  const {data,error}=await auth.supabase.rpc("replace_report_image",{
    p_image:imageId,p_expected_path:parsed.data.expectedPath,p_expected_caption:parsed.data.expectedCaption,
    p_new_path:parsed.data.path,p_caption:parsed.data.caption.trim(),p_size:parsed.data.size,
  });
  if(error)return apiError(error.message,rpcError(error.message));
  const {data:signed,error:signError}=await auth.supabase.storage.from("report-images").createSignedUrl(data,300);
  return NextResponse.json({path:data,caption:parsed.data.caption.trim(),url:signError ? "" : signed.signedUrl});
}
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
  const {error}=await auth.supabase.rpc("remove_report_image",{p_image:imageId});if(error)return apiError(error.message,rpcError(error.message));
  // The storage object can still be referenced by a published version.
  return NextResponse.json({ok:true});
}
