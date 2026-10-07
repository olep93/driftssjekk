"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordForm() {
  const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const result = await response.json();
    if (!response.ok) setMessage(result.error || "Passordet kunne ikke oppdateres.");
    else { router.push("/oversikt"); router.refresh(); }
  }
  return <div className="setup-card"><h1>Velg ditt eget passord</h1><p className="muted">Bruk minst 12 tegn. Et midlertidig passord må byttes før du fortsetter.</p><form onSubmit={submit} className="form-stack"><label>Nytt passord<input type="password" minLength={12} maxLength={128} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="button primary">Lagre passord</button></form><p role="status">{message}</p></div>;
}
