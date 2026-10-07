import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function apiClient({ allowTemporaryPassword = false }: { allowTemporaryPassword?: boolean } = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const { data: identity, error: identityError } = await supabase.auth.getUser();
  if (identityError || !identity.user || (!allowTemporaryPassword && identity.user.app_metadata?.must_change_password)) return null;
  return { supabase, userId: data.claims.sub };
}
export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
export function rpcError(message: string) {
  return /Ingen tilgang|Ikke innlogget/.test(message) ? 403 : /Versjonskonflikt/.test(message) ? 409 : 400;
}
