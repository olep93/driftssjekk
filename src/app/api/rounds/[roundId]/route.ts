import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";
export async function PATCH(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget",401);
  const { roundId } = await params;
  if (!z.uuid().safeParse(roundId).success) return apiError("Ugyldig runde");
  const parsed = z.discriminatedUnion("operation",[
    z.object({ operation: z.literal("status"), status: z.enum(["planned","active","closed"]), reason: z.string().nullable() }),
    z.object({ operation: z.literal("exception"), storeId: z.uuid(), reason: z.string().trim().min(1) }),
    z.object({ operation: z.literal("summary"), summary: z.string().max(20000) }),
  ]).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Ugyldige data");
  const { error } = parsed.data.operation === "status"
    ? await auth.supabase.rpc("set_round_status", { p_round: roundId, p_status: parsed.data.status, p_reason: parsed.data.reason })
    : parsed.data.operation === "exception"
      ? await auth.supabase.rpc("set_round_exception", { p_round: roundId, p_store: parsed.data.storeId, p_reason: parsed.data.reason })
      : await auth.supabase.rpc("update_round_summary", { p_round: roundId, p_summary: parsed.data.summary });
  if (error) return apiError(error.message,rpcError(error.message));
  return NextResponse.json({ ok: true });
}
