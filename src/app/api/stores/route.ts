import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";
export async function POST(request:Request){const auth=await apiClient();if(!auth)return apiError("Ikke innlogget",401);const parsed=z.object({cooperativeId:z.uuid(),name:z.string().trim().min(2).max(150)}).safeParse(await request.json().catch(()=>null));if(!parsed.success)return apiError("Ugyldige varehusdata");const {data,error}=await auth.supabase.rpc("create_store",{p_coop:parsed.data.cooperativeId,p_name:parsed.data.name});if(error)return apiError(error.message,rpcError(error.message));return NextResponse.json({id:data});}
