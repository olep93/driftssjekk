import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";

const area = z.object({ score_quarters: z.number().int().min(4).max(40).nullable(), comment: z.string().max(10000), needs_follow_up: z.boolean() });
const schema = z.object({ lockVersion: z.number().int().positive(), visitDate: z.iso.date().nullable(), summary: z.string().max(20000), areas: z.record(z.enum(["drive_in","store","outdoor","goods_receiving"]), area) });
export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget",401);
  const { versionId } = await params;
  if (!z.uuid().safeParse(versionId).success) return apiError("Ugyldig rapport");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Ugyldige rapportdata");
  const { data, error } = await auth.supabase.rpc("save_draft", { p_version: versionId, p_lock: parsed.data.lockVersion, p_visit_date: parsed.data.visitDate, p_summary: parsed.data.summary, p_areas: parsed.data.areas });
  if (error) return apiError(error.message,rpcError(error.message));
  return NextResponse.json({ lockVersion: data });
}
export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget",401);
  const { versionId } = await params;
  if (!z.uuid().safeParse(versionId).success) return apiError("Ugyldig rapport");
  const parsed = z.object({ lockVersion: z.number().int().positive(), reason: z.string().max(2000).nullable() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Ugyldig publisering");
  const { data, error } = await auth.supabase.rpc("publish_report", { p_version: versionId, p_lock: parsed.data.lockVersion, p_reason: parsed.data.reason });
  if (error) return apiError(error.message,rpcError(error.message));
  return NextResponse.json({ reportId: data });
}
