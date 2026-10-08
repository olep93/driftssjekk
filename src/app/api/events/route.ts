import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError, rpcError } from "@/lib/api";

const areaKey = z.enum(["drive_in", "store", "outdoor", "goods_receiving"]);
const schema = z.object({
  cooperativeId: z.uuid(), title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(3000), locationStoreId: z.uuid(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  participants: z.array(z.object({ userId: z.uuid(), homeStoreId: z.uuid(), areaKeys: z.array(areaKey).min(1).max(4)
    .refine((items) => new Set(items).size === items.length, "Velg hvert område én gang") })).min(1).max(100)
    .refine((items) => new Set(items.map((item) => item.userId)).size === items.length, "Hver deltaker må velges én gang")
    .refine((items) => new Set(items.flatMap((item) => item.areaKeys)).size === 4, "Fordel alle fire områder"),
});

export async function POST(request: Request) {
  const auth = await apiClient(); if (!auth) return apiError("Ikke innlogget", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Kontroller samlingsdato, varehus og deltakere.");
  const value = parsed.data;
  const { data, error } = await auth.supabase.rpc("create_event", {
    p_coop: value.cooperativeId, p_title: value.title, p_description: value.description,
    p_location: value.locationStoreId,
    p_starts: value.startsAt, p_ends: value.endsAt,
    p_participants: value.participants.map((item) => ({ user_id: item.userId, home_store_id: item.homeStoreId, area_keys: item.areaKeys })),
  });
  if (error) return apiError(error.message, rpcError(error.message));
  return NextResponse.json({ eventId: data });
}
