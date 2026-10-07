import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";

const schema = z.object({ cooperativeId: z.uuid(), title: z.string().trim().min(1).max(150), from: z.iso.date().nullable(), to: z.iso.date().nullable(), storeIds: z.array(z.uuid()).min(1) });
export async function POST(request: Request) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget",401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Ugyldige rundedata");
  const { data, error } = await auth.supabase.rpc("create_round", { p_coop: parsed.data.cooperativeId, p_title: parsed.data.title, p_from: parsed.data.from, p_to: parsed.data.to, p_stores: parsed.data.storeIds });
  if (error) return apiError(error.message,rpcError(error.message));
  return NextResponse.json({ roundId: data });
}
