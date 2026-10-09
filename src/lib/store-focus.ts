import { cookies } from "next/headers";
import type { Membership } from "@/lib/auth";
import type { Store } from "@/lib/data";

export const STORE_FOCUS_COOKIE = "driftssjekk_store_focus";

export function operationStores(stores: Store[], memberships: Membership[]) {
  return stores.filter((store) => memberships.some((member) => member.role === "operations" && member.cooperative_id === store.cooperative_id && (member.store_id === null || member.store_id === store.id)));
}

export async function focusedStoreId(stores: Store[], memberships: Membership[]) {
  const requested = (await cookies()).get(STORE_FOCUS_COOKIE)?.value;
  return operationStores(stores, memberships).find((store) => store.id === requested)?.id || null;
}

export function selectedStoreId(requested: string | undefined, focused: string | null, stores: Store[]) {
  if (requested === "all") return null;
  if (requested) return stores.some((store) => store.id === requested) ? requested : null;
  return focused && stores.some((store) => store.id === focused) ? focused : null;
}
