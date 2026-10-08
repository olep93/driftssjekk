import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeEvent, type EventSourceSnapshot } from "@/lib/event-summary";
import { buildReportPdf } from "@/lib/pdf";
import { buildReportPptx } from "@/lib/pptx";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget", 401);
  const { eventId } = await params;
  if (!z.uuid().safeParse(eventId).success) return apiError("Ugyldig samling");
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "pdf" && format !== "pptx") return apiError("Ugyldig filformat");
  const { data: mayManage } = await auth.supabase.rpc("can_manage_event", { p_event: eventId });
  if (!mayManage) return apiError("Ingen tilgang til samlingsrapporten", 403);
  const [{ data: event }, { data: participants }, { data: reports }] = await Promise.all([
    auth.supabase.from("events").select("id,title,description,cooperative_id,location_store_id,starts_at").eq("id", eventId).maybeSingle(),
    auth.supabase.from("event_participants").select("user_id").eq("event_id", eventId),
    auth.supabase.from("reports").select("created_by,current_version_id,withdrawn_at").eq("event_id", eventId),
  ]);
  if (!event) return apiError("Samlingen finnes ikke", 404);
  const published = (reports || []).filter((report) => report.current_version_id && !report.withdrawn_at);
  if (!participants?.length || published.length !== participants.length)
    return apiError("Alle deltakerne må publisere før samlet rapport kan lages", 409);
  const versionIds = published.map((report) => report.current_version_id!);
  const [{ data: snapshots }, { data: profiles }, { data: store }, { data: coop }] = await Promise.all([
    auth.supabase.from("publication_snapshots").select("version_id,content").in("version_id", versionIds),
    auth.supabase.from("profiles").select("id,display_name").in("id", participants.map((item) => item.user_id)),
    auth.supabase.from("stores").select("name").eq("id", event.location_store_id).maybeSingle(),
    auth.supabase.from("cooperatives").select("name").eq("id", event.cooperative_id).maybeSingle(),
  ]);
  if (snapshots?.length !== participants.length || !store || !coop)
    return apiError("Samlet rapport mangler publiserte vurderinger", 409);
  const contributions = published.map((report) => ({
    name: profiles?.find((profile) => profile.id === report.created_by)?.display_name || "Deltaker",
    snapshot: snapshots.find((snapshot) => snapshot.version_id === report.current_version_id)?.content as EventSourceSnapshot,
  }));
  if (contributions.some((contribution) => !contribution.snapshot?.areas))
    return apiError("En vurdering mangler rapportgrunnlag", 409);
  const combined = summarizeEvent(contributions);
  if (combined.covered !== 4 || combined.total === null)
    return apiError("Alle fire områder må være vurdert før samlet rapport kan lages", 409);
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(event.starts_at));
  const snapshot = {
    kind: "event_check", store_name: store.name, cooperative_name: coop.name,
    round_title: event.title, visit_date: date,
    assessor_name: `${contributions.length} ${contributions.length === 1 ? "deltaker" : "deltakere"}`,
    summary: [event.description, `Samlet konseptvurdering fra ${contributions.length} deltakere. Hvert område er gjennomsnittet av alle innsendte vurderinger av området.`].filter(Boolean).join("\n\n"),
    total: combined.total, version_no: 1, areas: combined.areas,
  };
  try {
    const admin = createAdminClient();
    const bytes = format === "pdf" ? await buildReportPdf(snapshot, admin) : await buildReportPptx(snapshot, admin);
    return new Response(Buffer.from(bytes), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="samling-${eventId}.${format}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return apiError("Kunne ikke lage samlet rapport. Prøv igjen.", 500);
  }
}
