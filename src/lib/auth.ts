import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Membership = { id: string; cooperative_id: string; store_id: string | null; role: "operations" | "store_manager" | "cooperative_admin" };
// Cached per request so the layout and the page share one auth check and one set of lookups.
export const getContext = cache(async () => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");
  // getUser stays authoritative for the admin flags; it runs alongside the lookups instead of before them.
  const [{ data: identity }, { data: memberships }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("memberships").select("id,cooperative_id,store_id,role").eq("user_id", userId),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);
  if (identity.user?.app_metadata?.must_change_password) redirect("/nytt-passord");
  return { supabase, userId, memberships: (memberships || []) as Membership[], name: profile?.display_name || "Bruker", systemAdmin: identity.user?.app_metadata?.system_admin === true };
});
export function isOperations(memberships: Membership[], cooperativeId?: string) {
  return memberships.some((m) => m.role === "operations" && (!cooperativeId || m.cooperative_id === cooperativeId));
}
export function isFullOperations(memberships: Membership[], cooperativeId?: string) {
  return memberships.some((m) => m.role === "operations" && m.store_id === null && (!cooperativeId || m.cooperative_id === cooperativeId));
}
export function canOperateStore(memberships: Membership[], cooperativeId: string, storeId: string) {
  return memberships.some((m) => m.role === "operations" && m.cooperative_id === cooperativeId && (m.store_id === null || m.store_id === storeId));
}
export function defaultCooperativeId(memberships: Membership[]) {
  return memberships.find((m) => m.role === "store_manager")?.cooperative_id || memberships[0]?.cooperative_id;
}
