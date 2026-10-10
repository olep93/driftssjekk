import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReportPdf, reportPdfPath } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await apiClient();
  if (!auth) return apiError("Ikke innlogget", 401);
  const { versionId } = await params;
  if (!z.uuid().safeParse(versionId).success) return apiError("Ugyldig rapport");

  // This read is subject to RLS. Only a user who can read the published
  // version may request privileged PDF work for it.
  const { data: job, error: readError } = await auth.supabase.from("exports")
    .select("id,status,attempts,object_path").eq("version_id", versionId).eq("kind", "report_pdf").maybeSingle();
  if (readError || !job) return apiError("PDF finnes ikke", 404);
  const path = reportPdfPath(versionId);
  if (job.status === "ready" && job.object_path === path) return NextResponse.json({ status: "ready" });
  if (job.status === "processing") return NextResponse.json({ status: "processing" }, { status: 202 });

  const admin = createAdminClient();
  const { data: claimed, error: claimError } = await admin.from("exports")
    .update({ status: "processing", attempts: job.attempts + 1, error: null, updated_at: new Date().toISOString() })
    .eq("id", job.id).in("status", ["pending", "failed", "ready"]).select("id").maybeSingle();
  if (claimError) return apiError("Kunne ikke starte PDF-generering", 500);
  if (!claimed) return NextResponse.json({ status: "processing" }, { status: 202 });

  try {
    const { data: snapshot, error: snapshotError } = await auth.supabase.from("publication_snapshots")
      .select("content").eq("version_id", versionId).single();
    if (snapshotError || !snapshot) throw new Error("Publiseringsgrunnlag mangler");
    const pdf = await buildReportPdf(snapshot.content as Parameters<typeof buildReportPdf>[0], admin, versionId);
    const { error: uploadError } = await admin.storage.from("report-exports")
      .upload(path, Buffer.from(pdf), { contentType: "application/pdf", upsert: false });
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError;
    const { error: updateError } = await admin.from("exports")
      .update({ status: "ready", object_path: path, error: null, updated_at: new Date().toISOString() }).eq("id", job.id);
    if (updateError) throw updateError;
    return NextResponse.json({ status: "ready" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF-generering feilet";
    await admin.from("exports").update({ status: "failed", error: message, updated_at: new Date().toISOString() }).eq("id", job.id);
    return apiError("PDF-generering feilet. Prøv igjen.", 500);
  }
}
