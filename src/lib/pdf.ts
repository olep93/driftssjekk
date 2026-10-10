import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReportPdfFromSnapshot, type ReportSnapshot } from "./report-template/build";

// Bumping the version gives stored PDFs a new path, so existing reports are rebuilt on the next download.
export const reportPdfTemplateVersion = "template-20261010b";
export function reportPdfPath(versionId: string) { return `reports/${versionId}-${reportPdfTemplateVersion}.pdf`; }

/** Report PDF from a publication snapshot. Pass the version id to include history, comparison and highlights. */
export function buildReportPdf(snapshot: ReportSnapshot, supabase: SupabaseClient, versionId?: string): Promise<Uint8Array> {
  return buildReportPdfFromSnapshot(snapshot, supabase, versionId);
}
