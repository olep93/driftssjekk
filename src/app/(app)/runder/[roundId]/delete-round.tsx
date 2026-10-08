"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteRound({ roundId }: { roundId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (prompt("Skriv SLETT for å slette denne runden permanent. Rapportene i runden må slettes først.") !== "SLETT") return;
    setBusy(true); setError("");
    const response = await fetch(`/api/round-deletions/${roundId}`, { method: "DELETE" });
    const result = await response.json();
    if (response.ok) { router.push("/runder"); router.refresh(); }
    else setError(result.error || "Kunne ikke slette runden");
    setBusy(false);
  }
  return <div className="page-actions no-print"><button type="button" className="button danger" disabled={busy} onClick={() => void remove()}>{busy ? "Sletter …" : "Slett runde"}</button>{error && <span className="feedback error" role="alert">{error}</span>}</div>;
}
