"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordForm({ redirectAfterSave = false }: { redirectAfterSave?: boolean }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("Passordene er ikke like.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Passordet kunne ikke oppdateres.");
      setPassword("");
      setConfirmation("");
      if (redirectAfterSave) {
        router.replace("/oversikt");
        router.refresh();
      } else setMessage("Passordet er endret.");
    } catch (issue) {
      setMessage(issue instanceof Error ? issue.message : "Kunne ikke kontakte serveren.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="form-stack">
    <label>Nytt passord<input type="password" minLength={8} maxLength={128} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <label>Gjenta nytt passord<input type="password" minLength={8} maxLength={128} required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
    <button className="button primary" disabled={busy}>{busy ? "Lagrer …" : "Lagre passord"}</button>
    {message && <p role="status" className="feedback">{message}</p>}
  </form>;
}
