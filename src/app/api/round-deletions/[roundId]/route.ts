import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const auth = await apiClient();
  if (!auth) return apiError("Ikke innlogget", 401);
  const { roundId } = await params;
  if (!z.uuid().safeParse(roundId).success) return apiError("Ugyldig runde");
  const { data: identity } = await auth.supabase.auth.getUser();
  if (identity.user?.app_metadata?.system_admin !== true) return apiError("Bare systemadministrator kan slette runder", 403);
  const { data: round } = await auth.supabase.from("rounds").select("id").eq("id", roundId).maybeSingle();
  if (!round) return apiError("Runden finnes ikke eller er ikke tilgjengelig", 404);
  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_delete_round", { p_round: roundId, p_actor: auth.userId });
  if (error) return apiError(error.message, 400);
  return NextResponse.json({ ok: true });
}
