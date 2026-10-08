import { NextResponse } from "next/server";
import { apiClient, apiError, rpcError } from "@/lib/api";

export async function POST(_: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget", 401);
  const { eventId } = await params;
  const { data, error } = await auth.supabase.rpc("create_event_report", { p_event: eventId });
  if (error) return apiError(error.message, rpcError(error.message));
  return NextResponse.json({ versionId: data });
}
