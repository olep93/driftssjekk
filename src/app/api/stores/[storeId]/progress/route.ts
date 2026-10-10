import { z } from "zod";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { apiClient, apiError } from "@/lib/api";
import type { Membership } from "@/lib/auth";
import { periodLabels } from "@/lib/store-progress";
import { canViewStore, loadStoreProgress, parsePeriod } from "@/lib/store-progress-data";
import { ProgressDocument } from "@/lib/report-template/progress-document";
import { buildProgressPptx } from "@/lib/progress-pptx";

export const runtime = "nodejs";
export const maxDuration = 60;
// Built on request from the same numbers as the store dashboard; everything is read under RLS.
export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget", 401);
  const { storeId } = await params;
  if (!z.uuid().safeParse(storeId).success) return apiError("Ugyldig varehus");
  const url = new URL(request.url), format = url.searchParams.get("format"), period = parsePeriod(url.searchParams.get("periode"));
  if (format !== "pdf" && format !== "pptx") return apiError("Ugyldig filformat");
  const [{ data: store }, { data: memberships }] = await Promise.all([
    auth.supabase.from("stores").select("id,name,cooperative_id").eq("id", storeId).maybeSingle(),
    auth.supabase.from("memberships").select("id,cooperative_id,store_id,role").eq("user_id", auth.userId),
  ]);
  if (!store || !canViewStore((memberships || []) as Membership[], store)) return apiError("Varehuset finnes ikke eller du mangler tilgang", 404);
  const { data: cooperative } = await auth.supabase.from("cooperatives").select("name").eq("id", store.cooperative_id).maybeSingle();
  try {
    const { today, progress, history, highlights } = await loadStoreProgress(auth.supabase, store, period);
    const data = { storeName: store.name, cooperativeName: cooperative?.name || "Samvirkelag", periodLabel: periodLabels[period], generatedAt: new Date().toISOString(), today, progress, highlights, history };
    const bytes = format === "pdf"
      ? await renderToBuffer(createElement(ProgressDocument, { data }) as Parameters<typeof renderToBuffer>[0])
      : Buffer.from(await buildProgressPptx(data));
    const name = `fremdrift-${store.name.toLowerCase().replace(/[^a-z0-9æøå]+/g, "-")}-${today}.${format}`;
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return apiError("Kunne ikke lage fremdriftsrapporten. Prøv igjen.", 500); }
}
