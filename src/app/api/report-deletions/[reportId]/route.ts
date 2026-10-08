import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const auth = await apiClient();
  if (!auth) return apiError("Ikke innlogget", 401);
  const { reportId } = await params;
  if (!z.uuid().safeParse(reportId).success) return apiError("Ugyldig rapport");
  const { data: identity } = await auth.supabase.auth.getUser();
  if (identity.user?.app_metadata?.system_admin !== true) return apiError("Bare systemadministrator kan slette rapporter.", 403);
  const admin = createAdminClient();
  const { data: report } = await auth.supabase.from("reports").select("id").eq("id", reportId).maybeSingle();
  if (!report) return apiError("Rapporten finnes ikke eller er ikke tilgjengelig.", 404);
  const { data, error } = await admin.rpc("admin_delete_report", { p_report: reportId, p_actor: auth.userId });
  if (error) return apiError(error.message, 500);
  const paths = data as { images?: string[]; exports?: string[]; action_images?: string[] } | null;
  const cleanup = await Promise.all([
    paths?.images?.length ? admin.storage.from("report-images").remove(paths.images) : Promise.resolve({ error: null }),
    paths?.exports?.length ? admin.storage.from("report-exports").remove(paths.exports) : Promise.resolve({ error: null }),
    paths?.action_images?.length ? admin.storage.from("action-images").remove(paths.action_images) : Promise.resolve({ error: null }),
  ]);
  return NextResponse.json({ ok: true, storageCleanupWarning: cleanup.some((result) => result.error) });
}
