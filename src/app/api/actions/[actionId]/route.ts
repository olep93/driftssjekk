import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";
export async function PATCH(request: Request, { params }: { params: Promise<{ actionId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget",401);
  const { actionId } = await params; if (!z.uuid().safeParse(actionId).success) return apiError("Ugyldig tiltak");
  const parsed = z.object({ status: z.enum(["open","in_progress","done"]), comment: z.string().trim().min(1).max(2000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Ugyldige data");
  const { data, error } = await auth.supabase.rpc("reply_action", { p_action: actionId, p_status: parsed.data.status, p_comment: parsed.data.comment });
  if (error) return apiError(error.message,rpcError(error.message));
  return NextResponse.json({ ok:true, updateId:data });
}
