import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget", 401);
  const { eventId } = await params; if (!z.uuid().safeParse(eventId).success) return apiError("Ugyldig samling");
  const { data: identity } = await auth.supabase.auth.getUser();
  if (identity.user?.app_metadata?.system_admin !== true) return apiError("Bare systemadministrator kan slette samlinger", 403);
  const { data: event } = await auth.supabase.from("events").select("id").eq("id", eventId).maybeSingle();
  if (!event) return apiError("Samlingen finnes ikke eller er ikke tilgjengelig", 404);
  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_delete_event", { p_event: eventId, p_actor: auth.userId });
  if (error) return apiError(error.message, 400);
  return NextResponse.json({ ok: true });
}
