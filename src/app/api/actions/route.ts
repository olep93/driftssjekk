import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";
const schema = z.object({ reportId: z.uuid(), area: z.enum(["drive_in","store","outdoor","goods_receiving"]).nullable(), description: z.string().trim().min(1).max(2000), assignee: z.uuid().nullable(), dueDate: z.iso.date().nullable() });
export async function POST(request: Request) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget",401);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return apiError("Ugyldig tiltak");
  const { data, error } = await auth.supabase.rpc("create_action", { p_report: parsed.data.reportId, p_area: parsed.data.area, p_description: parsed.data.description, p_assignee: parsed.data.assignee, p_due: parsed.data.dueDate });
  if (error) return apiError(error.message,rpcError(error.message));
  return NextResponse.json({ id: data });
}
