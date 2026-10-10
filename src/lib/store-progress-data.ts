import type { SupabaseClient } from "@supabase/supabase-js";
import type { Membership } from "./auth";
import { loadCore, scoreFor } from "./data";
import { areas } from "./scoring";
import { storeProgress, type Period, type ProgressReport } from "./store-progress";

export const osloToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(new Date());
export const parsePeriod = (value: string | null | undefined): Period => value === "6m" || value === "year" ? value : "12m";

/** Store managers of the store, its operations managers and cooperative admins may follow its progress. */
export function canViewStore(memberships: Membership[], store: { id: string; cooperative_id: string }) {
  return memberships.some((membership) => membership.cooperative_id === store.cooperative_id &&
    (membership.role === "cooperative_admin" || membership.store_id === store.id || (membership.role === "operations" && membership.store_id === null)));
}

const lines = (value: string | null | undefined) => (value || "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3);

/**
 * Everything the store dashboard and the progress report show, read under the caller's RLS.
 * Both use this so the numbers in the app and in the downloaded report always match.
 */
export async function loadStoreProgress(supabase: SupabaseClient, store: { id: string; cooperative_id: string }, period: Period) {
  const data = await loadCore(supabase, store.cooperative_id);
  const reports = data.reports.filter((report) => report.store_id === store.id && report.current_version_id && !report.withdrawn_at);
  const visitDate = (reportId: string) => data.versions.find((version) => version.id === data.reports.find((report) => report.id === reportId)?.current_version_id)?.visit_date || "";
  const drafts = data.reports.filter((report) => report.store_id === store.id && !report.archived_at && !report.withdrawn_at)
    .flatMap((report) => data.versions.filter((version) => version.report_id === report.id && version.state === "draft").map((version) => ({ report, version })));
  const storeReportIds = data.reports.filter((report) => report.store_id === store.id && !report.withdrawn_at).map((report) => report.id);
  const currentVersionIds = reports.map((report) => report.current_version_id!);
  // Task dates and highlights are not part of the shared core data, so they are read here.
  const [{ data: taskRows }, { data: highlightRows }] = await Promise.all([
    storeReportIds.length ? supabase.from("actions").select("id,report_id,description,area_key,status,due_date,created_at,updated_at").in("report_id", storeReportIds) : Promise.resolve({ data: [] }),
    currentVersionIds.length ? supabase.from("report_versions").select("id,report_id,visit_date,strengths,improvements").in("id", currentVersionIds) : Promise.resolve({ data: [] }),
  ]);
  const progressReports = reports.filter((report) => !report.event_id).map((report): ProgressReport => {
    const versionId = report.current_version_id!;
    return { id: report.id, kind: report.kind === "self_check" ? "self_check" : "inspection", date: visitDate(report.id), total: scoreFor(report, data.versions, data.areas),
      areas: Object.fromEntries(areas.map((area) => { const quarters = data.areas.find((row) => row.version_id === versionId && row.area_key === area.key)?.score_quarters; return [area.key, quarters == null ? null : quarters / 4]; })) };
  }).filter((report) => report.date);
  const today = osloToday();
  const progress = storeProgress(progressReports, (taskRows || []).map((task) => ({ id: task.id, description: task.description, areaKey: task.area_key, status: task.status, dueDate: task.due_date, createdAt: task.created_at, updatedAt: task.updated_at })), period, today);
  const latestHighlights = (highlightRows || []).filter((row) => lines(row.strengths).length || lines(row.improvements).length)
    .sort((a, b) => (b.visit_date || "").localeCompare(a.visit_date || ""))[0];
  const history = reports.map((report) => ({ id: report.id, kind: report.kind, eventId: report.event_id, date: visitDate(report.id), total: scoreFor(report, data.versions, data.areas) }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    today, progress, drafts, history,
    highlights: latestHighlights ? { date: latestHighlights.visit_date as string, strengths: lines(latestHighlights.strengths), improvements: lines(latestHighlights.improvements) } : null,
  };
}
export type StoreProgressData = Awaited<ReturnType<typeof loadStoreProgress>>;
