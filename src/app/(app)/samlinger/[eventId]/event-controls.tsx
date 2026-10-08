"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EventControls({ eventId, status, canManage, canStart = false }: { eventId: string; status: string; canManage: boolean; canStart?: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function start() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/start`, { method: "POST" });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Kunne ikke starte vurderingen");
      router.push(`/rapporter/rediger/${result.versionId}`); router.refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Kunne ikke starte vurderingen"); setBusy(false); }
  }
  async function setStatus(next: "planned" | "closed") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Kunne ikke endre status");
      router.refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Kunne ikke endre status"); }
    finally { setBusy(false); }
  }
  return <div>{canStart && status === "planned" && <button className="button primary" type="button" disabled={busy} onClick={() => void start()}>{busy ? "Starter …" : "Start konseptrunde"}</button>}
    {canManage && <button className="button" type="button" disabled={busy} onClick={() => void setStatus(status === "closed" ? "planned" : "closed")}>{status === "closed" ? "Åpne samlingen igjen" : "Avslutt samlingen"}</button>}
    {error && <p className="feedback error" role="alert">{error}</p>}</div>;
}
