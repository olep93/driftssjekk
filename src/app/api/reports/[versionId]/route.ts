import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";
import { areas } from "@/lib/scoring";

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget",401);
  const { versionId } = await params;
  if (!z.uuid().safeParse(versionId).success) return apiError("Ugyldig rapport");
  const [{data:version},{data:rows},{data:imageRows}] = await Promise.all([
    auth.supabase.from("report_versions").select("state,lock_version,visit_date,summary,strengths,improvements,updated_at").eq("id",versionId).maybeSingle(),
    auth.supabase.from("area_assessments").select("area_key,score_quarters,comment,needs_follow_up").eq("version_id",versionId),
    auth.supabase.from("report_images").select("id,area_key,caption,object_path").eq("version_id",versionId).order("sort_order"),
  ]);
  if (!version) return apiError("Rapporten finnes ikke eller du mangler tilgang",404);
  const images = await Promise.all((imageRows || []).map(async (image) => {
    const {data} = await auth.supabase.storage.from("report-images").createSignedUrl(image.object_path,300);
    return {id:image.id,area_key:image.area_key,caption:image.caption,path:image.object_path,url:data?.signedUrl || ""};
  }));
  return NextResponse.json({state:version.state,lockVersion:version.lock_version,updatedAt:version.updated_at,
    fields:{visitDate:version.visit_date || "",summary:version.summary || "",strengths:version.strengths || "",improvements:version.improvements || "",areas:Object.fromEntries(areas.map((area) => {
      const row=rows?.find((item) => item.area_key === area.key);
      return [area.key,{score_quarters:row?.score_quarters ?? null,comment:row?.comment || "",needs_follow_up:row?.needs_follow_up || false}];
    }))},images});
}

const area = z.object({ score_quarters: z.number().int().min(4).max(40).nullable(), comment: z.string().max(10000), needs_follow_up: z.boolean() });
// One point per line, at most three, matching what the report summary shows.
const highlights = z.string().max(1000).refine((value) => value.split("\n").filter((line) => line.trim()).length <= 3, "Maks tre punkter");
const schema = z.object({ lockVersion: z.number().int().positive(), visitDate: z.iso.date().nullable(), summary: z.string().max(20000), strengths: highlights, improvements: highlights, areas: z.record(z.enum(["drive_in","store","outdoor","goods_receiving"]), area) });
export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget",401);
  const { versionId } = await params;
  if (!z.uuid().safeParse(versionId).success) return apiError("Ugyldig rapport");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Ugyldige rapportdata");
  const { data, error } = await auth.supabase.rpc("save_draft", { p_version: versionId, p_lock: parsed.data.lockVersion, p_visit_date: parsed.data.visitDate, p_summary: parsed.data.summary, p_areas: parsed.data.areas, p_strengths: parsed.data.strengths, p_improvements: parsed.data.improvements });
  if (error?.message.includes("Ingen tilgang til kladd")) {
    const {data:version}=await auth.supabase.from("report_versions").select("state").eq("id",versionId).maybeSingle();
    if(version?.state==="published")return apiError("Rapporten ble publisert av en annen bruker. Last inn siden på nytt.",409);
  }
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
  if (error?.message.includes("Ingen tilgang til kladd")) {
    const {data:version}=await auth.supabase.from("report_versions").select("state").eq("id",versionId).maybeSingle();
    if(version?.state==="published")return apiError("Rapporten ble publisert av en annen bruker. Last inn siden på nytt.",409);
  }
  if (error) return apiError(error.message,rpcError(error.message));
  return NextResponse.json({ reportId: data });
}
