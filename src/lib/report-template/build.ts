import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { areas } from "../scoring";
import { reportKindLabel } from "../report-kind";
import { peerComparison } from "./layout";
import { renderReportPdf } from "./render";
import type { ReportDocumentData, ReportPhoto } from "./report-document";

/** The publication snapshot stored when a report is published. */
export type ReportSnapshot = { kind: string; store_name: string; cooperative_name: string; round_title: string | null; visit_date: string; assessor_name: string; summary: string; total: number | null; version_no: number; areas: { key: string; score_quarters: number | null; comment: string; needs_follow_up: boolean; images: { path: string; caption: string }[] }[] };

const lines = (value: string | null | undefined) => (value || "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3);

/** Downloads a photo, applies its EXIF rotation and caps it at 1600 px so large sets keep the PDF small. */
export async function loadPhoto(storage: SupabaseClient, bucket: string, path: string, caption: string): Promise<ReportPhoto | null> {
  try {
    const { data, error } = await storage.storage.from(bucket).download(path);
    if (error || !data) return null;
    const { data: bytes, info } = await sharp(Buffer.from(await data.arrayBuffer())).rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer({ resolveWithObject: true });
    return { data: bytes, width: info.width, height: info.height, caption };
  } catch { return null; }
}

type Context = Pick<ReportDocumentData, "strengths" | "improvements" | "previousTotal" | "peer" | "history">;
const emptyContext: Context = { strengths: [], improvements: [], previousTotal: null, peer: null, history: [] };
const yearBefore = (date: string) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 1); return d.toISOString().slice(0, 10); };

/**
 * Reads what the snapshot does not hold: the version's strengths and improvements, earlier concept
 * checks in the same store, and the cooperative's recent concept checks. Uses the service client
 * because PDFs are also built by the background job; only the comparison result leaves this function.
 */
async function loadContext(admin: SupabaseClient, versionId: string, snapshot: ReportSnapshot): Promise<Context> {
  const { data: version } = await admin.from("report_versions").select("report_id,strengths,improvements").eq("id", versionId).maybeSingle();
  if (!version) return emptyContext;
  const context: Context = { ...emptyContext, strengths: lines(version.strengths), improvements: lines(version.improvements) };
  if (snapshot.kind !== "inspection") return context;
  const { data: report } = await admin.from("reports").select("store_id,cooperative_id").eq("id", version.report_id).maybeSingle();
  if (!report) return context;
  // Concept checks only: monthly reviews and event results stay out of the ranking and the comparison.
  const { data: published } = await admin.from("reports").select("id,store_id,current_version_id")
    .eq("cooperative_id", report.cooperative_id).eq("kind", "inspection").is("event_id", null).is("withdrawn_at", null).not("current_version_id", "is", null);
  const versionIds = (published || []).map((item) => item.current_version_id as string);
  if (!versionIds.length) return context;
  const [{ data: snapshots }, { data: versions }] = await Promise.all([
    admin.from("publication_snapshots").select("version_id,content").in("version_id", versionIds),
    admin.from("report_versions").select("id,visit_date").in("id", versionIds),
  ]);
  const rows = (published || []).map((item) => ({
    storeId: item.store_id as string,
    date: versions?.find((row) => row.id === item.current_version_id)?.visit_date as string | undefined,
    total: (snapshots?.find((row) => row.version_id === item.current_version_id)?.content as { total?: number | null } | undefined)?.total ?? null,
    versionId: item.current_version_id as string,
  })).filter((row): row is { storeId: string; date: string; total: number; versionId: string } => !!row.date && row.total !== null && row.date <= snapshot.visit_date);
  const own = rows.filter((row) => row.storeId === report.store_id).sort((a, b) => a.date.localeCompare(b.date) || (a.versionId === versionId ? 1 : -1));
  const index = own.findIndex((row) => row.versionId === versionId);
  const upToThis = index >= 0 ? own.slice(0, index + 1) : [...own, { storeId: report.store_id, date: snapshot.visit_date, total: snapshot.total ?? 0, versionId }];
  context.history = snapshot.total === null ? [] : upToThis.slice(-6).map((row) => ({ date: row.date, total: row.total }));
  context.previousTotal = upToThis.length > 1 ? upToThis[upToThis.length - 2].total : null;
  // Latest concept check per other store in the twelve months before this visit.
  const since = yearBefore(snapshot.visit_date), latest = new Map<string, { date: string; total: number }>();
  for (const row of rows) {
    if (row.storeId === report.store_id || row.date < since) continue;
    const known = latest.get(row.storeId);
    if (!known || row.date > known.date) latest.set(row.storeId, row);
  }
  context.peer = peerComparison(snapshot.total, [...latest.values()].map((row) => row.total));
  return context;
}

/** Builds the report PDF from a publication snapshot. Without a version id (events), the extra context is left out. */
export async function buildReportPdfFromSnapshot(snapshot: ReportSnapshot, admin: SupabaseClient, versionId?: string): Promise<Uint8Array> {
  const context = versionId ? await loadContext(admin, versionId, snapshot).catch(() => emptyContext) : emptyContext;
  const reportAreas = areas.filter((area) => snapshot.areas.some((item) => item.key === area.key));
  const data: ReportDocumentData = {
    kind: snapshot.kind === "self_check" ? "self_check" : snapshot.kind === "event_check" ? "event_check" : "inspection",
    kindLabel: reportKindLabel(snapshot.kind), storeName: snapshot.store_name, cooperativeName: snapshot.cooperative_name,
    roundTitle: snapshot.round_title, visitDate: snapshot.visit_date, assessorName: snapshot.assessor_name, versionNo: snapshot.version_no,
    total: snapshot.total, partial: snapshot.kind === "event_check" && reportAreas.length < 4, summary: snapshot.summary,
    ...context,
    areas: await Promise.all(reportAreas.map(async (area) => {
      const item = snapshot.areas.find((entry) => entry.key === area.key)!;
      const photos = await Promise.all(item.images.map((image) => loadPhoto(admin, "report-images", image.path, image.caption)));
      return { key: area.key, label: area.label, score: item.score_quarters === null ? null : item.score_quarters / 4, comment: item.comment, needsFollowUp: item.needs_follow_up, photos: photos.filter((photo): photo is ReportPhoto => !!photo) };
    })),
    // Tasks are created after publication, so they belong in the follow-up report, not the locked one.
    tasks: [],
  };
  return new Uint8Array(await renderReportPdf(data));
}
