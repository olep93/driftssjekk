"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Store = { id: string; name: string; cooperative_id: string };
type Coop = { id: string; name: string };
type Round = { id: string; title: string; cooperative_id: string; status: string };
type SharedDraft = { versionId: string; storeId: string; roundId: string | null; updatedAt: string };

export default function NewReportForm({ stores, coops, rounds, sharedDrafts, kind, initialStore, initialRound }: {
  stores: Store[]; coops: Coop[]; rounds: Round[]; sharedDrafts: SharedDraft[]; kind: "inspection" | "self_check"; initialStore?: string; initialRound?: string;
}) {
  const router = useRouter();
  const preferredStore = initialStore && stores.some((item) => item.id === initialStore) ? initialStore : stores[0]?.id || "";
  const [storeId, setStoreId] = useState(preferredStore);
  const [coopId, setCoopId] = useState(stores.find((item) => item.id === preferredStore)?.cooperative_id || "");
  const [roundId, setRoundId] = useState(initialRound || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const availableCoops = coops.filter((coop) => stores.some((store) => store.cooperative_id === coop.id));
  const availableStores = stores.filter((store) => store.cooperative_id === coopId);
  const matchingDrafts = kind === "inspection" ? sharedDrafts.filter((draft) => draft.storeId === storeId && draft.roundId === (roundId || null)) : [];
  const roundDraftExists = Boolean(roundId && matchingDrafts.length);

  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, roundId: kind === "inspection" && roundId ? roundId : null, kind }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke opprette rapport");
      router.push(`/rapporter/rediger/${result.versionId}`);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Kunne ikke opprette rapport"); setBusy(false); }
  }

  return <form onSubmit={create} className="form-stack">
    {availableCoops.length > 1 && <label>Samvirkelag<select value={coopId} onChange={(event) => {
      const next = event.target.value; setCoopId(next); setStoreId(stores.find((store) => store.cooperative_id === next)?.id || ""); setRoundId("");
    }}>{availableCoops.map((coop) => <option key={coop.id} value={coop.id}>{coop.name}</option>)}</select></label>}
    <label>Varehus<select required value={storeId} onChange={(event) => { setStoreId(event.target.value); setRoundId(""); }}>
      {availableStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
    </select></label>
    {kind === "inspection" && <label>Konseptsjekkrunde<select value={roundId} onChange={(event) => setRoundId(event.target.value)}><option value="">Enkeltbesøk utenfor runde</option>{rounds.filter((round) => round.cooperative_id === coopId).map((round) => <option key={round.id} value={round.id}>{round.title}</option>)}</select></label>}
    {matchingDrafts.length > 0 && <div className="feedback" role="status"><strong>{matchingDrafts.length === 1 ? "Felles kladd finnes allerede" : `${matchingDrafts.length} felles kladder finnes allerede`}</strong><p className="small" style={{margin:"7px 0 12px"}}>Driftssjefer som har tilgang til dette varehuset kan jobbe videre i samme konseptsjekk. Åpne kladden og fortsett der kollegaen slapp.</p>{matchingDrafts.map((draft) => <Link key={draft.versionId} className="button" style={{margin:"0 8px 8px 0"}} href={`/rapporter/rediger/${draft.versionId}`}>Fortsett kladd fra {new Intl.DateTimeFormat("nb-NO",{timeZone:"Europe/Oslo",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(draft.updatedAt))}</Link>)}</div>}
    <p className="muted small">{kind === "inspection" ? "Konseptsjekken inngår i rangering når den publiseres i en runde." : "Månedlig driftsgjennomgang har karakterer, kommentarer og bilder per område. Resultatet brukes til intern progresjon og teller ikke i konseptrangeringen."}</p>
    {error && <p className="feedback error" role="alert">{error}</p>}
    <button className="button primary" disabled={busy || !storeId || roundDraftExists}>{busy ? "Oppretter …" : roundDraftExists ? "Fortsett i felles kladd over" : matchingDrafts.length ? "Start en separat sjekk" : "Start registrering"}</button>
  </form>;
}
