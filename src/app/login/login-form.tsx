"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reset, setReset] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    const supabase = createClient();
    if (reset) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/nytt-passord` });
      setMessage(error ? "Kunne ikke sende lenken. Prøv igjen." : "Hvis adressen finnes, får du en lenke på e-post.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage("Innlogging mislyktes. Kontroller e-post og passord.");
      else { router.push("/oversikt"); router.refresh(); }
    }
    setLoading(false);
  }
  return <div className="login-card"><p className="eyebrow">Velkommen tilbake</p><h2>{reset ? "Tilbakestill passord" : "Logg inn"}</h2><p className="muted">{reset ? "Vi sender en lenke til e-postadressen din." : "Bruk kontoen du er invitert med."}</p><form onSubmit={submit} className="form-stack"><label>E-postadresse<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="navn@eksempel.no" /></label>{!reset && <label>Passord<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>}<button className="button primary" disabled={loading}>{loading ? "Vennligst vent …" : reset ? "Send lenke" : "Logg inn"}</button></form>{message && <p role="status" className="feedback">{message}</p>}<button type="button" className="text-button" onClick={() => { setReset(!reset); setMessage(""); }}>{reset ? "Tilbake til innlogging" : "Glemt passord?"}</button></div>;
}
