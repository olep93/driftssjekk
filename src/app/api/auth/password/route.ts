import { NextResponse } from "next/server";
import { z } from "zod";
import { apiClient, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ password: z.string().min(12).max(128) });

export async function POST(request: Request) {
  const auth = await apiClient({ allowTemporaryPassword: true });
  if (!auth) return apiError("Ikke innlogget", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Passordet må ha minst 12 tegn.");
  const { data: identity, error: identityError } = await auth.supabase.auth.getUser();
  if (identityError || !identity.user) return apiError("Økten er utløpt. Åpne lenken på nytt.", 401);
  const { error } = await auth.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return apiError("Passordet kunne ikke oppdateres.");
  if (identity.user.app_metadata?.must_change_password) {
    const { error: metadataError } = await createAdminClient().auth.admin.updateUserById(auth.userId, {
      app_metadata: { ...identity.user.app_metadata, must_change_password: false },
    });
    if (metadataError) return apiError("Passordet ble endret, men aktiveringen må fullføres. Prøv igjen.", 500);
  }
  return NextResponse.json({ ok: true });
}
