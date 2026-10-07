"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Store = { id: string; name: string; cooperative_id: string };
type Round = { id: string; title: string; cooperative_id: string; status: string };
export default function NewReportForm({ stores, rounds, kind, initialStore, initialRound }: { stores: Store[]; rounds: Round[]; kind: "inspection" | "self_check"; initialStore?: string; initialRound?: string }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(initialStore && stores.some((s) => s.id === initialStore) ? initialStore : stores[0]?.id || "");
  const [roundId, setRoundId] = useState(initialRound || "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const coop = stores.find((s) => s.id === storeId)?.cooperative_id;
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/reports", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ storeId, roundId: kind === "inspection" && roundId ? roundId : null, kind }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Kunne ikke opprette rapport");
      router.push(`/rapporter/rediger/${result.versionId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Kunne ikke opprette rapport"); setBusy(false); }
  }
  return <form onSubmit={create} className="form-stack"><label>Varehus<select required value={storeId} onChange={(e) => {setStoreId(e.target.value);setRoundId("");}}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{kind === "inspection" && <label>Runde<select value={roundId} onChange={(e) => setRoundId(e.target.value)}><option value="">Enkeltbesøk utenfor runde</option>{rounds.filter((r) => r.cooperative_id === coop).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>}<p className="muted small">{kind === "inspection" ? "Driftssjekken inngår i offisiell rangering når den publiseres i en runde." : "Egenkontrollen vises separat og inngår ikke i regional rangering."}</p>{error && <p role="alert" className="feedback error">{error}</p>}<button className="button primary" disabled={busy || !storeId}>{busy ? "Oppretter …" : "Start registrering"}</button></form>;
}
