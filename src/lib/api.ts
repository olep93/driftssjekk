import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function apiClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub };
}
export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
export function rpcError(message: string) {
  return /Ingen tilgang|Ikke innlogget/.test(message) ? 403 : /Versjonskonflikt/.test(message) ? 409 : 400;
}
