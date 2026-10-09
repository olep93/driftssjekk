import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ actionId: string }> }) {
  const auth = await apiClient();
  if (!auth) return apiError("Ikke innlogget", 401);
  const { actionId } = await params;
  if (!z.uuid().safeParse(actionId).success) return apiError("Ugyldig oppgave");
  const form = await request.formData().catch(() => null);
  if (!form) return apiError("Ugyldig bilde");
  const file = form.get("image");
  const sourceImageId = form.get("sourceImageId");
  const updateId = form.get("updateId");
  const caption = String(form.get("caption") || "").trim();
  if (caption.length > 500) return apiError("Bildeteksten er for lang");
  if ((file instanceof File) === (typeof sourceImageId === "string" && sourceImageId.length > 0))
    return apiError("Velg ett bilde eller ett rapportbilde");
  if (updateId && (typeof updateId !== "string" || !z.uuid().safeParse(updateId).success)) return apiError("Ugyldig svar");
  const { data: action } = await auth.supabase.from("actions").select("id,report_id").eq("id", actionId).maybeSingle();
  if (!action) return apiError("Oppgaven finnes ikke eller du mangler tilgang", 404);
  const { data: report } = await auth.supabase.from("reports").select("id,store_id,cooperative_id").eq("id", action.report_id).maybeSingle();
  if (!report) return apiError("Rapporten finnes ikke", 404);
  const { data: memberships } = await auth.supabase.from("memberships").select("role,store_id,cooperative_id").eq("user_id", auth.userId);
  const operations = memberships?.some((entry) => entry.role === "operations" && entry.cooperative_id === report.cooperative_id && (entry.store_id === null || entry.store_id === report.store_id));
  const manager = memberships?.some((entry) => entry.role === "store_manager" && entry.store_id === report.store_id);
  if (!operations && !manager) return apiError("Ingen tilgang", 403);
  if (sourceImageId && !operations) return apiError("Bare driftssjef kan knytte til rapportbilder", 403);
  if (updateId) {
    const { data: update } = await auth.supabase.from("action_updates").select("id")
      .eq("id", updateId).eq("action_id", actionId).eq("actor_id", auth.userId).maybeSingle();
    if (!update) return apiError("Svaret finnes ikke", 404);
  }
  const admin = createAdminClient();
  let input: Buffer;
  if (file instanceof File) {
    if (file.size < 1 || file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return apiError("Bildet må være JPEG, PNG eller WebP på maks 10 MB");
    input = Buffer.from(await file.arrayBuffer());
  } else {
    if (typeof sourceImageId !== "string" || !z.uuid().safeParse(sourceImageId).success) return apiError("Ugyldig rapportbilde");
    const { data: source } = await admin.from("report_images").select("id,version_id,object_path").eq("id", sourceImageId).maybeSingle();
    if (!source) return apiError("Rapportbildet finnes ikke", 404);
    const { data: version } = await admin.from("report_versions").select("report_id").eq("id", source.version_id).maybeSingle();
    if (version?.report_id !== report.id) return apiError("Bildet tilhører en annen rapport", 403);
    const { data: blob, error } = await admin.storage.from("report-images").download(source.object_path);
    if (error || !blob) return apiError("Kunne ikke hente rapportbildet", 502);
    input = Buffer.from(await blob.arrayBuffer());
  }
  let bytes: Buffer;
  try {
    const metadata = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || "")) return apiError("Ugyldig bildeformat");
    bytes = await sharp(input, { limitInputPixels: 50_000_000 }).rotate()
      // Same size and quality as report photos, to stay within the storage quota.
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 }).toBuffer();
  } catch { return apiError("Kunne ikke behandle bildet"); }
  const path = `${actionId}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await admin.storage.from("action-images").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (uploadError) return apiError("Kunne ikke lagre bildet", 502);
  const { data: saved, error: saveError } = await admin.from("action_images").insert({
    action_id: actionId, update_id: updateId || null, object_path: path, caption, uploaded_by: auth.userId,
  }).select("id").single();
  if (saveError) {
    await admin.storage.from("action-images").remove([path]);
    return apiError("Kunne ikke knytte bildet til oppgaven", 500);
  }
  return NextResponse.json({ id: saved.id });
}
