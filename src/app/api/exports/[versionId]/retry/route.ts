import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient,apiError,rpcError } from "@/lib/api";
export async function POST(_request:Request,{params}:{params:Promise<{versionId:string}>}){const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);const {versionId}=await params;if(!z.uuid().safeParse(versionId).success)return apiError("Ugyldig rapport");const {error}=await auth.supabase.rpc("retry_export",{p_version:versionId});if(error)return apiError(error.message,rpcError(error.message));return NextResponse.json({ok:true});}
