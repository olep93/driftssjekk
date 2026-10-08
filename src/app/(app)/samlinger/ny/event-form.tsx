"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { areas, type AreaKey } from "@/lib/scoring";

type Store = { id: string; name: string; cooperative_id: string };
type Coop = { id: string; name: string };
type Manager = { user_id: string; cooperative_id: string; store_id: string; name: string };

export default function EventForm({ stores, coops, managers }: { stores: Store[]; coops: Coop[]; managers: Manager[] }) {
  const router = useRouter();
  const [coop, setCoop] = useState(coops.find((item) => item.name === "Coop Sørøst")?.id || coops[0]?.id || "");
  const availableStores = stores.filter((store) => store.cooperative_id === coop);
  const [location, setLocation] = useState(availableStores[0]?.id || "");
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [starts, setStarts] = useState(""); const [ends, setEnds] = useState("");
  const [selected, setSelected] = useState<Record<string, { homeStoreId: string; areaKeys: AreaKey[] }>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const availableManagers = managers.filter((manager) => manager.cooperative_id === coop && availableStores.some((store) => store.id === manager.store_id));
  const uniqueManagers = [...new Map(availableManagers.map((manager) => [manager.user_id, manager])).values()].map((manager) => ({
    ...manager, assignedStores: availableStores.filter((store) => availableManagers.some((item) => item.user_id === manager.user_id && item.store_id === store.id)),
  }));
  const uncovered = areas.filter((area) => !Object.values(selected).some((assignment) => assignment.areaKeys.includes(area.key)));

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        cooperativeId: coop, title, description, locationStoreId: location,
        startsAt: new Date(starts).toISOString(), endsAt: ends ? new Date(ends).toISOString() : null,
        participants: Object.entries(selected).map(([userId, assignment]) => ({ userId, ...assignment })),
      }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Kunne ikke opprette samlingen");
      router.push(`/samlinger/${result.eventId}`); router.refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Kunne ikke opprette samlingen"); setBusy(false); }
  }

  return <form className="form-stack" onSubmit={submit}>
    {coops.length > 1 && <label>Samvirkelag<select value={coop} onChange={(event) => { const id = event.target.value; setCoop(id); setLocation(stores.find((store) => store.cooperative_id === id)?.id || ""); setSelected({}); }}>{coops.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <label>Navn på samlingen<input required minLength={3} maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Felles konseptsamling i Sandefjord"/></label>
    <label>Beskrivelse og praktisk informasjon<textarea maxLength={3000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Oppmøtested, program og hva deltakerne skal gjøre"/></label>
    <label>Varehuset dere besøker<select required value={location} onChange={(event) => setLocation(event.target.value)}>{availableStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
    <div className="grid-2"><label>Start<input required type="datetime-local" value={starts} onChange={(event) => setStarts(event.target.value)}/></label><label>Slutt (valgfritt)<input type="datetime-local" min={starts} value={ends} onChange={(event) => setEnds(event.target.value)}/></label></div>
    <p className="muted small">Alle vurderer varehuset dere besøker. Fordel gjerne områdene mellom deltakerne; hver deltaker får sin egen vurdering.</p>
    <fieldset className="selection-fieldset"><legend>Inviter og fordel områder</legend>{uniqueManagers.map((manager) => <div className="selection-option" key={manager.user_id}><label><input type="checkbox" checked={Boolean(selected[manager.user_id])} onChange={(event) => setSelected((old) => {
      if (event.target.checked) return { ...old, [manager.user_id]: { homeStoreId: manager.assignedStores[0]?.id || "", areaKeys: areas.map((area) => area.key) } };
      const next = { ...old }; delete next[manager.user_id]; return next;
    })}/><span><strong>{manager.name}</strong><small>{manager.assignedStores.map((store) => store.name).join(", ")}</small></span></label>{selected[manager.user_id] && <div className="participant-assignment">{manager.assignedStores.length > 1 && <label className="manager-home-store">Deltar fra varehus<select value={selected[manager.user_id].homeStoreId} onChange={(event) => setSelected((old) => ({ ...old, [manager.user_id]: { ...old[manager.user_id], homeStoreId: event.target.value } }))}>{manager.assignedStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>}<span className="small muted">Områder som skal vurderes</span><div className="area-assignment-grid">{areas.map((area) => <label key={area.key}><input type="checkbox" checked={selected[manager.user_id].areaKeys.includes(area.key)} disabled={selected[manager.user_id].areaKeys.length === 1 && selected[manager.user_id].areaKeys.includes(area.key)} onChange={(event) => setSelected((old) => ({ ...old, [manager.user_id]: { ...old[manager.user_id], areaKeys: event.target.checked ? [...old[manager.user_id].areaKeys, area.key] : old[manager.user_id].areaKeys.filter((key) => key !== area.key) } }))}/>{area.label}</label>)}</div></div>}</div>)}{!uniqueManagers.length && <p className="muted">Ingen varehussjefer er opprettet for disse varehusene ennå.</p>}</fieldset>
    {Object.keys(selected).length > 0 && uncovered.length > 0 && <p className="feedback error" role="status">Fordel også {uncovered.map((area) => area.label).join(", ")} før du oppretter samlingen.</p>}
    <p className="muted small">Invitasjonen vises i Driftssjekk. Automatisk e-post er ikke satt opp ennå. Vurderingene holdes utenfor offisiell rangering og månedlig progresjon.</p>
    {error && <p className="feedback error" role="alert">{error}</p>}
    <button className="button primary" disabled={busy || !location || !Object.keys(selected).length || !starts || uncovered.length > 0}>{busy ? "Oppretter …" : "Opprett samling"}</button>
  </form>;
}
