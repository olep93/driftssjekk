import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget", 401);
  const parsed = z.object({ status: z.enum(["planned", "closed"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Ugyldig status");
  const { eventId } = await params;
  const { error } = await auth.supabase.rpc("set_event_status", { p_event: eventId, p_status: parsed.data.status });
  if (error) return apiError(error.message, rpcError(error.message));
  return NextResponse.json({ ok: true });
}
