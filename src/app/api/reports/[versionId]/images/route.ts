import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";

const schema = z.object({ area: z.enum(["drive_in","store","outdoor","goods_receiving"]), path: z.string().max(250), caption: z.string().max(1000), type: z.enum(["image/jpeg","image/png","image/webp"]), size: z.number().int().min(1).max(10485760) });
export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget",401);
  const { versionId } = await params;
  if (!z.uuid().safeParse(versionId).success) return apiError("Ugyldig rapport");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Ugyldig bilde");
  const { data, error } = await auth.supabase.rpc("add_report_image", { p_version: versionId, p_area: parsed.data.area, p_path: parsed.data.path, p_caption: parsed.data.caption, p_type: parsed.data.type, p_size: parsed.data.size });
  if (error) return apiError(error.message,rpcError(error.message));
  return NextResponse.json({ id: data });
}
