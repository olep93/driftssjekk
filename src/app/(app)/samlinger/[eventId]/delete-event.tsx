"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteEvent({ eventId }: { eventId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function remove() {
    if (prompt("Skriv SLETT for å slette samlingen permanent. Eventuelle vurderinger må slettes først.") !== "SLETT") return;
    setBusy(true); setError("");
    const response = await fetch(`/api/event-deletions/${eventId}`, { method: "DELETE" });
    const result = await response.json();
    if (response.ok) { router.push("/samlinger"); router.refresh(); }
    else setError(result.error || "Kunne ikke slette samlingen");
    setBusy(false);
  }
  return <div className="page-actions no-print" style={{marginTop:20}}><button type="button" className="button danger" disabled={busy} onClick={() => void remove()}>{busy ? "Sletter …" : "Slett samling"}</button>{error && <span className="feedback error" role="alert">{error}</span>}</div>;
}
