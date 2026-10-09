"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StoreFocus({ stores, value, compact = false }: { stores: { id: string; name: string; cooperativeName: string }[]; value: string | null; compact?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState(value || "");
  if (stores.length < 2) return null;
  const groups = [...new Set(stores.map((store) => store.cooperativeName))].sort((a, b) => a.localeCompare(b, "nb"));
  function change(next: string) {
    setSelected(next);
    document.cookie = `driftssjekk_store_focus=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (["/oversikt", "/rapporter", "/oppfolging"].includes(pathname)) {
      if (next) params.set("store", next); else params.delete("store");
      params.delete("page");
      if (pathname === "/oversikt") params.delete("round");
      router.replace(`${pathname}${params.size ? `?${params}` : ""}`);
    } else router.refresh();
  }
  return <label className={`store-focus${compact ? " store-focus-mobile" : ""}`}><span>Varehus i fokus</span><select aria-label="Varehus i fokus" value={selected} onChange={(event) => change(event.target.value)}><option value="">Alle varehus</option>{groups.length === 1 ? stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>) : groups.map((group) => <optgroup key={group} label={group}>{stores.filter((store) => store.cooperativeName === group).map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</optgroup>)}</select></label>;
}
