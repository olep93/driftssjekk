import type { SupabaseClient } from "@supabase/supabase-js";
import { averageFromQuarters, totalFromQuarters, type AreaKey } from "./scoring";

export type Store = { id: string; cooperative_id: string; name: string; active: boolean };
export type Round = { id: string; cooperative_id: string; title: string; sequence_no: number; status: string; planned_from: string | null; planned_to: string | null; summary: string };
export type Report = { id: string; cooperative_id: string; store_id: string; round_id: string | null; event_id: string | null; kind: "inspection" | "self_check"; current_version_id: string | null; created_at: string; archived_at: string | null; withdrawn_at: string | null; created_by: string };
export type Version = { id: string; report_id: string; version_no: number; state: "draft" | "published"; visit_date: string | null; summary: string; strengths?: string; improvements?: string; lock_version: number; updated_at?: string; published_at: string | null; change_reason: string | null; assessor_id: string };
export type Area = { version_id: string; area_key: AreaKey; score_quarters: number | null; comment: string; needs_follow_up: boolean };
export type Action = { id: string; report_id: string; description: string; status: string; due_date: string | null; area_key: string | null };

export async function loadCore(supabase: SupabaseClient, cooperativeId?: string) {
  const storeQuery = supabase.from("stores").select("id,cooperative_id,name,active").order("name");
  const roundQuery = supabase.from("rounds").select("id,cooperative_id,title,sequence_no,status,planned_from,planned_to,summary").order("sequence_no", { ascending: false });
  const reportQuery = supabase.from("reports").select("id,cooperative_id,store_id,round_id,event_id,kind,current_version_id,created_at,archived_at,withdrawn_at,created_by").order("created_at", { ascending: false }).limit(500);
  const [storesResult, roundsResult, reportsResult] = await Promise.all([
    cooperativeId ? storeQuery.eq("cooperative_id", cooperativeId) : storeQuery,
    cooperativeId ? roundQuery.eq("cooperative_id", cooperativeId) : roundQuery,
    cooperativeId ? reportQuery.eq("cooperative_id", cooperativeId) : reportQuery,
  ]);
  const stores = (storesResult.data || []) as Store[];
  const rounds = (roundsResult.data || []) as Round[];
  const reports = (reportsResult.data || []) as Report[];
  const versionIds = reports.map((r) => r.current_version_id).filter((id): id is string => !!id);
  const reportIds = reports.map((r) => r.id);
  const [versionsResult, areasResult, actionsResult] = await Promise.all([
    reportIds.length ? supabase.from("report_versions").select("id,report_id,version_no,state,visit_date,summary,lock_version,published_at,change_reason,assessor_id").in("report_id", reportIds) : Promise.resolve({ data: [] }),
    versionIds.length ? supabase.from("area_assessments").select("version_id,area_key,score_quarters,comment,needs_follow_up").in("version_id", versionIds) : Promise.resolve({ data: [] }),
    reports.length ? supabase.from("actions").select("id,report_id,description,status,due_date,area_key").in("report_id", reports.map((r) => r.id)).limit(500) : Promise.resolve({ data: [] }),
  ]);
  return { stores, rounds, reports, versions: (versionsResult.data || []) as Version[], areas: (areasResult.data || []) as Area[], actions: (actionsResult.data || []) as Action[] };
}

export function scoreFor(report: Report | undefined, versions: Version[], areas: Area[]): number | null {
  if (!report) return null;
  const version = versions.find((v) => v.id === report.current_version_id);
  if (!version) return null;
  const scores = areas.filter((a) => a.version_id === version.id).map((a) => a.score_quarters);
  return scores.every((n): n is number => n !== null)
    ? report.event_id ? averageFromQuarters(scores as number[]) : totalFromQuarters(scores as number[])
    : null;
}

export function latestInspections(reports: Report[], versions: Version[]): Report[] {
  const current = reports.filter((r) => r.kind === "inspection" && r.current_version_id && !r.withdrawn_at);
  const sorted = [...current].sort((a, b) => {
    const av = versions.find((v) => v.id === a.current_version_id)?.visit_date || "";
    const bv = versions.find((v) => v.id === b.current_version_id)?.visit_date || "";
    return bv.localeCompare(av);
  });
  const seen = new Set<string>();
  return sorted.filter((r) => { if (seen.has(r.store_id)) return false; seen.add(r.store_id); return true; });
}
