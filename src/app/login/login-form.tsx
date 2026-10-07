"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) setMessage("Innlogging mislyktes. Kontroller e-post og passord.");
    else { router.push("/oversikt"); router.refresh(); }
    setLoading(false);
  }

  return <div className="login-card"><p className="eyebrow">Velkommen tilbake</p><h2>Logg inn</h2>
    <p className="muted">Bruk kontoen administrator har opprettet for deg.</p>
    <form onSubmit={submit} className="form-stack">
      <label>E-postadresse<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="navn@eksempel.no" /></label>
      <label>Passord<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button className="button primary" disabled={loading}>{loading ? "Vennligst vent …" : "Logg inn"}</button>
    </form>
    {message && <p role="status" className="feedback">{message}</p>}
    <div className="login-help"><Link href="/onsker-tilgang">Ønsker tilgang?</Link><a href="mailto:ole.kristiansen@coop.no?subject=Passord%20til%20Driftssjekk">Glemt passord? Kontakt administrator</a></div>
  </div>;
}
