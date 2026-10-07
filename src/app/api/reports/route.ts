import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";

const schema = z.object({ storeId: z.uuid(), roundId: z.uuid().nullable(), kind: z.enum(["inspection","self_check"]) });
export async function POST(request: Request) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget",401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Ugyldige rapportdata");
  const { data, error } = await auth.supabase.rpc("create_report", { p_store: parsed.data.storeId, p_round: parsed.data.roundId, p_kind: parsed.data.kind });
  if (error) return apiError(error.message,rpcError(error.message));
  return NextResponse.json({ versionId: data });
}
