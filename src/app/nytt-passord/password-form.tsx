"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function PasswordForm() {
  const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const { error } = await createClient().auth.updateUser({ password });
    if (error) setMessage("Passordet kunne ikke oppdateres. Åpne lenken i e-posten på nytt.");
    else { router.push("/oversikt"); router.refresh(); }
  }
  return <div className="setup-card"><h1>Nytt passord</h1><form onSubmit={submit} className="form-stack"><label>Velg passord<input type="password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="button primary">Lagre passord</button></form><p role="status">{message}</p></div>;
}
