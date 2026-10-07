import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  cooperativeId: z.uuid(),
  storeId: z.uuid().nullable(),
  role: z.enum(["operations", "store_manager", "cooperative_admin"]),
  email: z.email().trim().toLowerCase(),
  name: z.string().trim().min(2).max(150),
  password: z.string().min(12).max(128).optional(),
});

export async function POST(request: Request) {
  const auth = await apiClient();
  if (!auth) return apiError("Ikke innlogget", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Kontroller navn, e-post og passord (minst 12 tegn).");
  const { cooperativeId, storeId, role, email, name, password } = parsed.data;

  const { data: myRole } = await auth.supabase.from("memberships").select("id")
    .eq("user_id", auth.userId).eq("cooperative_id", cooperativeId).eq("role", "cooperative_admin").maybeSingle();
  if (!myRole) return apiError("Ingen tilgang", 403);
  if ((role === "store_manager") !== Boolean(storeId)) return apiError("Varehussjef må ha ett varehus.");
  if (storeId) {
    const { data: store } = await auth.supabase.from("stores").select("id")
      .eq("id", storeId).eq("cooperative_id", cooperativeId).eq("active", true).maybeSingle();
    if (!store) return apiError("Ugyldig varehus.");
  }

  try {
    const admin = createAdminClient();
    let existingId: string | undefined;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) return apiError("Kunne ikke kontrollere eksisterende brukere.", 503);
      existingId = data.users.find((user) => user.email?.toLowerCase() === email)?.id;
      if (existingId || data.users.length < 100) break;
    }
    let userId = existingId;
    let created = false;
    if (!userId) {
      if (!password) return apiError("Nye brukere må få et midlertidig passord på minst 12 tegn.");
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { display_name: name },
        app_metadata: { must_change_password: true },
      });
      if (error || !data.user) return apiError(error?.message || "Kunne ikke opprette brukeren.", 409);
      userId = data.user.id;
      created = true;
      const { error: profileError } = await admin.from("profiles").upsert({ id: userId, display_name: name });
      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        return apiError("Kunne ikke lagre brukerprofilen.", 500);
      }
    }
    let priorQuery = admin.from("memberships").select("id")
      .eq("user_id", userId).eq("cooperative_id", cooperativeId).eq("role", role);
    priorQuery = storeId ? priorQuery.eq("store_id", storeId) : priorQuery.is("store_id", null);
    const { data: prior } = await priorQuery.maybeSingle();
    if (prior) return NextResponse.json({ ok: true, created: false, assigned: false });
    const { error: membershipError } = await admin.from("memberships")
      .insert({ user_id: userId, cooperative_id: cooperativeId, store_id: storeId, role });
    if (membershipError) {
      if (created) await admin.auth.admin.deleteUser(userId);
      return apiError("Kunne ikke tildele rollen. Prøv igjen.", 500);
    }
    await admin.from("audit_events").insert({ cooperative_id: cooperativeId, actor_id: auth.userId,
      event_type: "granted", object_type: "membership", object_id: userId,
      details: { role, store_id: storeId, account_created: created } });
    return NextResponse.json({ ok: true, created, assigned: true });
  } catch {
    return apiError("Brukeropprettelse er ikke konfigurert.", 503);
  }
}
