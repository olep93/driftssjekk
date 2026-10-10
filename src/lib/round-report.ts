import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCore, scoreFor } from "./data";
import { areas, type AreaKey } from "./scoring";

export type RoundEntry = { storeId: string; storeName: string; reportId: string; date: string; total: number | null; areas: Record<AreaKey, number | null>; strengths: string[]; improvements: string[]; summary: string };
export type RoundInfo = { id: string; title: string; sequence: number; from: string | null; to: string | null; status: string };

const average = (values: (number | null)[]) => { const scored = values.filter((value): value is number => value !== null); return scored.length ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null; };

/**
 * Everything a round report shows, from the round's entries and the earlier rounds' entries:
 * the ranking with the change since the previous round, the area averages across stores and
 * the round average over time. Ties share a place, as on the overview.
 */
export function summarizeRound(round: RoundInfo, entries: RoundEntry[], expected: number, earlier: { round: RoundInfo; entries: RoundEntry[] }[]) {
  const previous = earlier.at(-1);
  const sorted = [...entries].sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || a.storeName.localeCompare(b.storeName, "nb"));
  const ranking = sorted.map((entry) => {
    const before = previous?.entries.find((item) => item.storeId === entry.storeId);
    return { ...entry, rank: 1 + sorted.filter((other) => (other.total ?? -1) > (entry.total ?? -1)).length,
      delta: entry.total !== null && before?.total != null ? entry.total - before.total : null };
  });
  const areaAverages = areas.map((area) => {
    const now = average(entries.map((entry) => entry.areas[area.key]));
    const before = previous ? average(previous.entries.map((entry) => entry.areas[area.key])) : null;
    const weakest = [...entries].filter((entry) => entry.areas[area.key] !== null).sort((a, b) => a.areas[area.key]! - b.areas[area.key]!)[0];
    return { key: area.key, label: area.label, average: now, change: now !== null && before !== null ? now - before : null, weakest: weakest ? { storeName: weakest.storeName, score: weakest.areas[area.key]! } : null };
  });
  const roundAverage = average(entries.map((entry) => entry.total));
  const previousAverage = previous ? average(previous.entries.map((entry) => entry.total)) : null;
  const history = [...earlier.map((item) => ({ title: item.round.title, from: item.round.from, average: average(item.entries.map((entry) => entry.total)) })), { title: round.title, from: round.from, average: roundAverage }];
  // Store × round matrix for the development table, in ranking order.
  const matrix = ranking.map((entry) => ({ storeName: entry.storeName, totals: [...earlier.map((item) => item.entries.find((other) => other.storeId === entry.storeId)?.total ?? null), entry.total] }));
  const scoredAreas = areaAverages.filter((area) => area.average !== null);
  return {
    round, ranking, areaAverages, history, matrix, previousTitle: previous?.round.title ?? null,
    roundAverage, averageChange: roundAverage !== null && previousAverage !== null ? roundAverage - previousAverage : null,
    completed: entries.length, expected,
    best: ranking.filter((entry) => entry.rank === 1 && entry.total !== null),
    weakestArea: scoredAreas.length ? scoredAreas.reduce((low, area) => area.average! < low.average! ? area : low) : null,
  };
}
export type RoundSummary = ReturnType<typeof summarizeRound>;

const lines = (value: string | null | undefined) => (value || "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3);

/** Reads a round and the cooperative's earlier rounds under the caller's RLS. */
export async function loadRoundReport(supabase: SupabaseClient, roundId: string) {
  const { data: round } = await supabase.from("rounds").select("id,cooperative_id,title,sequence_no,planned_from,planned_to,status").eq("id", roundId).maybeSingle();
  if (!round) return null;
  const [core, { data: cooperative }, { data: participants }] = await Promise.all([
    loadCore(supabase, round.cooperative_id),
    supabase.from("cooperatives").select("name").eq("id", round.cooperative_id).maybeSingle(),
    supabase.from("round_stores").select("store_id,exception_reason").eq("round_id", roundId),
  ]);
  const info = (row: { id: string; title: string; sequence_no: number; planned_from: string | null; planned_to: string | null; status: string }): RoundInfo =>
    ({ id: row.id, title: row.title, sequence: row.sequence_no, from: row.planned_from, to: row.planned_to, status: row.status });
  const roundReports = core.reports.filter((report) => report.kind === "inspection" && report.round_id && report.current_version_id && !report.withdrawn_at);
  const versionIds = roundReports.map((report) => report.current_version_id!);
  const { data: versionRows } = versionIds.length ? await supabase.from("report_versions").select("id,strengths,improvements,summary").in("id", versionIds) : { data: [] };
  const entriesFor = (id: string): RoundEntry[] => roundReports.filter((report) => report.round_id === id).map((report) => {
    const version = core.versions.find((item) => item.id === report.current_version_id), extra = versionRows?.find((item) => item.id === report.current_version_id);
    return { storeId: report.store_id, storeName: core.stores.find((store) => store.id === report.store_id)?.name || "Varehus", reportId: report.id, date: version?.visit_date || "",
      total: scoreFor(report, core.versions, core.areas),
      areas: Object.fromEntries(areas.map((area) => { const quarters = core.areas.find((row) => row.version_id === report.current_version_id && row.area_key === area.key)?.score_quarters; return [area.key, quarters == null ? null : quarters / 4]; })) as Record<AreaKey, number | null>,
      strengths: lines(extra?.strengths), improvements: lines(extra?.improvements), summary: extra?.summary || "" };
  });
  const earlier = core.rounds.filter((item) => item.sequence_no < round.sequence_no).sort((a, b) => a.sequence_no - b.sequence_no).slice(-5)
    .map((item) => ({ round: info({ ...item, status: item.status }), entries: entriesFor(item.id) })).filter((item) => item.entries.length);
  const summary = summarizeRound(info(round), entriesFor(roundId), (participants || []).filter((participant) => !participant.exception_reason).length, earlier);
  const roundReportIds = roundReports.filter((report) => report.round_id === roundId).map((report) => report.id);
  const openTasks = core.actions.filter((action) => roundReportIds.includes(action.report_id) && action.status !== "done").map((action) => ({
    ...action, storeName: summary.ranking.find((entry) => entry.reportId === action.report_id)?.storeName || "Varehus",
  }));
  return { cooperativeId: round.cooperative_id, cooperativeName: cooperative?.name || "Samvirkelag", summary, openTasks };
}
export type RoundReportData = NonNullable<Awaited<ReturnType<typeof loadRoundReport>>>;
