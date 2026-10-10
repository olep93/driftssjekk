import { z } from "zod";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { apiClient, apiError } from "@/lib/api";
import { isFullOperations, type Membership } from "@/lib/auth";
import { loadRoundReport } from "@/lib/round-report";
import { osloToday } from "@/lib/store-progress-data";
import { RoundDocument } from "@/lib/report-template/round-document";
import { buildRoundPptx } from "@/lib/round-pptx";

export const runtime = "nodejs";
export const maxDuration = 60;
// Same access as the round page: operations managers for the whole cooperative. Reads go through RLS.
export async function GET(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget", 401);
  const { roundId } = await params;
  if (!z.uuid().safeParse(roundId).success) return apiError("Ugyldig runde");
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "pdf" && format !== "pptx") return apiError("Ugyldig filformat");
  const [data, { data: memberships }] = await Promise.all([
    loadRoundReport(auth.supabase, roundId),
    auth.supabase.from("memberships").select("id,cooperative_id,store_id,role").eq("user_id", auth.userId),
  ]);
  if (!data || !isFullOperations((memberships || []) as Membership[], data.cooperativeId)) return apiError("Runden finnes ikke eller du mangler tilgang", 404);
  try {
    const today = osloToday();
    const bytes = format === "pdf"
      ? await renderToBuffer(createElement(RoundDocument, { data, today }) as Parameters<typeof renderToBuffer>[0])
      : Buffer.from(await buildRoundPptx(data, today));
    const name = `runderapport-${data.summary.round.title.toLowerCase().replace(/[^a-z0-9æøå]+/g, "-")}.${format}`;
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return apiError("Kunne ikke lage runderapporten. Prøv igjen.", 500); }
}
