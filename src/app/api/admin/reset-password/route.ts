import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  const auth = await apiClient();
  if (!auth) return apiError("Ikke innlogget", 401);
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return apiError("Ugyldig forespørsel", 403);

  const { data: identity, error: identityError } = await auth.supabase.auth.getUser();
  if (identityError || identity.user?.app_metadata?.system_admin !== true)
    return apiError("Bare systemadministrator kan tilbakestille passord", 403);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Kontroller e-postadresse og midlertidig passord (minst 12 tegn).");

  try {
    const admin = createAdminClient();
    let target: { id: string; app_metadata: Record<string, unknown>; email?: string } | undefined;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) return apiError("Kunne ikke kontrollere brukerkontoen", 503);
      target = data.users.find((user) => user.email?.toLowerCase() === parsed.data.email);
      if (target || data.users.length < 100) break;
    }
    if (!target) return apiError("Ingen brukerkonto med denne e-postadressen", 404);
    if (target.id === auth.userId || target.app_metadata?.system_admin === true)
      return apiError("Systemadministratorkontoer kan ikke tilbakestilles her", 403);

    const { data: membership, error: membershipError } = await admin.from("memberships")
      .select("cooperative_id").eq("user_id", target.id).limit(1).maybeSingle();
    if (membershipError) return apiError("Kunne ikke kontrollere brukerens tilgang", 503);
    if (!membership) return apiError("Brukeren har ingen tilgang i Driftssjekk", 404);

    const { error: resetError } = await admin.auth.admin.updateUserById(target.id, {
      password: parsed.data.password,
      app_metadata: { ...target.app_metadata, must_change_password: true },
    });
    if (resetError) return apiError("Passordet kunne ikke tilbakestilles", 503);

    const { error: auditError } = await admin.from("audit_events").insert({
      cooperative_id: membership.cooperative_id,
      actor_id: auth.userId,
      event_type: "password_reset",
      object_type: "user",
      object_id: target.id,
    });
    return NextResponse.json({ ok: true, auditWarning: Boolean(auditError) });
  } catch {
    return apiError("Passordtilbakestilling er ikke konfigurert", 503);
  }
}
