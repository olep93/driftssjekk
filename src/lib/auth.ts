import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Membership = { id: string; cooperative_id: string; store_id: string | null; role: "operations" | "store_manager" | "cooperative_admin" };
export async function getContext() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");
  const { data: identity } = await supabase.auth.getUser();
  if (identity.user?.app_metadata?.must_change_password) redirect("/nytt-passord");
  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase.from("memberships").select("id,cooperative_id,store_id,role").eq("user_id", userId),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);
  return { supabase, userId, memberships: (memberships || []) as Membership[], name: profile?.display_name || "Bruker" };
}
export function isOperations(memberships: Membership[], cooperativeId?: string) {
  return memberships.some((m) => m.role === "operations" && (!cooperativeId || m.cooperative_id === cooperativeId));
}
