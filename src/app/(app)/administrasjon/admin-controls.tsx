"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Coop = { id: string; name: string };
type Store = { id: string; name: string; cooperative_id: string; active: boolean };
type Membership = { id: string; user_id: string; cooperative_id: string; store_id: string | null; role: string };
type Profile = { id: string; display_name: string };

export default function AdminControls({ coops, stores, memberships, profiles }: {
  coops: Coop[]; stores: Store[]; memberships: Membership[]; profiles: Profile[];
}) {
  const router = useRouter();
  const [coop, setCoop] = useState(coops.find((item) => item.name === "Coop Sørøst")?.id || coops[0]?.id || "");
  const [storeName, setStoreName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [existingAccount, setExistingAccount] = useState(false);
  const [role, setRole] = useState("store_manager");
  const [storeId, setStoreId] = useState("");
  const [allStores, setAllStores] = useState(true);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createStore(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/stores", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cooperativeId: coop, name: storeName }) });
      const result = await response.json();
      setMessage(response.ok ? "Varehuset er opprettet." : result.error || "Kunne ikke opprette varehuset.");
      if (response.ok) { setStoreName(""); router.refresh(); }
    } catch { setMessage("Kunne ikke kontakte serveren."); }
    finally { setBusy(false); }
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cooperativeId: coop, storeId: role === "store_manager" ? storeId : null,
          storeIds: role === "operations" && !allStores ? selectedStores : [],
          role, email, name, password: existingAccount ? undefined : password }) });
      const result = await response.json();
      if (response.ok) {
        setMessage(result.created
          ? "Brukeren er opprettet. Del det midlertidige passordet direkte med brukeren. Passordet må byttes ved første innlogging."
          : result.assigned ? "Eksisterende bruker har fått tilgang. Det tidligere passordet er uendret."
            : "Brukeren hadde allerede denne tilgangen.");
        setName(""); setEmail(""); setPassword(""); setSelectedStores([]); router.refresh();
      } else setMessage(result.error || "Kunne ikke opprette brukeren.");
    } catch { setMessage("Kunne ikke kontakte serveren."); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    if (!confirm("Fjerne denne tilgangen?")) return;
    const response = await fetch(`/api/memberships/${id}`, { method: "DELETE" });
    const result = await response.json();
    setMessage(response.ok ? "Tilgangen er fjernet." : result.error || "Kunne ikke fjerne tilgang.");
    if (response.ok) router.refresh();
  }

  return <>
    <div className="filters" style={{ marginBottom: 20 }}><label>Samvirkelag
      <select value={coop} onChange={(event) => { setCoop(event.target.value); setStoreId(""); setSelectedStores([]); }}>
        {coops.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label></div>
    <div className="grid-2">
      <section className="panel" style={{ marginTop: 0 }}><h2>Legg til varehus</h2>
        <form className="form-stack" onSubmit={createStore}>
          <label>Varehusnavn<input value={storeName} onChange={(event) => setStoreName(event.target.value)} required minLength={2} /></label>
          <button className="button primary" disabled={busy}>Opprett varehus</button>
        </form>
      </section>
      <section className="panel" style={{ marginTop: 0 }}><h2>Opprett bruker og tildel tilgang</h2>
        <p className="muted small">Nye brukere får et midlertidig passord som du deler direkte. E-post sendes ikke automatisk ennå.</p>
        <form className="form-stack" onSubmit={createUser}>
          <label>Navn<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label>
          <label>E-post<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="off" /></label>
          <label className="checkbox-label"><input type="checkbox" checked={existingAccount} onChange={(event) => { setExistingAccount(event.target.checked); setPassword(""); }} /> Kontoen finnes allerede</label>
          {!existingAccount && <label>Midlertidig passord<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /></label>}
          <label>Rolle<select value={role} onChange={(event) => { setRole(event.target.value); setStoreId(""); }}>
            <option value="store_manager">Varehussjef</option>
            <option value="operations">Driftssjef</option>
            <option value="cooperative_admin">Samvirkelagsadministrator</option>
          </select></label>
          {role === "store_manager" && <label>Varehus<select required value={storeId} onChange={(event) => setStoreId(event.target.value)}>
            <option value="">Velg varehus</option>
            {stores.filter((store) => store.cooperative_id === coop && store.active).map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select></label>}
          {role === "operations" && <fieldset className="access-scope"><legend>Tilgang som driftssjef</legend>
            <label className="checkbox-label"><input type="checkbox" checked={allStores} onChange={(event) => { setAllStores(event.target.checked); setSelectedStores([]); }} /> Alle varehus i samvirkelaget</label>
            {!allStores && <><p className="muted small">Velg varehus driftssjefen kan se og gjennomføre konseptsjekk for.</p>
              {stores.filter((store) => store.cooperative_id === coop && store.active).map((store) => <label className="checkbox-label" key={store.id}>
                <input type="checkbox" checked={selectedStores.includes(store.id)} onChange={(event) => setSelectedStores((current) => event.target.checked ? [...current, store.id] : current.filter((id) => id !== store.id))} /> {store.name}
              </label>)}
            </>}
          </fieldset>}
          <button className="button primary" disabled={busy || (role === "operations" && !allStores && !selectedStores.length)}>{busy ? "Lagrer …" : "Opprett / tildel tilgang"}</button>
        </form>
      </section>
    </div>
    {message && <p role="status" className="feedback">{message}</p>}
    <section className="panel"><h2>Rolletildelinger</h2><div className="table-wrap"><table><thead><tr><th>Bruker</th><th>Rolle</th><th>Varehus</th><th></th></tr></thead><tbody>
      {memberships.filter((membership) => membership.cooperative_id === coop).map((membership) => <tr key={membership.id}>
        <td>{profiles.find((profile) => profile.id === membership.user_id)?.display_name || membership.user_id.slice(0, 8)}</td>
        <td>{membership.role === "operations" ? "Driftssjef" : membership.role === "store_manager" ? "Varehussjef" : "Administrator"}</td>
        <td>{stores.find((store) => store.id === membership.store_id)?.name || "Alle varehus i samvirkelaget"}</td>
        <td><button className="text-button" onClick={() => void revoke(membership.id)}>Fjern tilgang</button></td>
      </tr>)}
    </tbody></table></div></section>
  </>;
}
