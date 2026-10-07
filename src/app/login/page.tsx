import { redirect } from "next/navigation";
import { configured, createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export default async function LoginPage() {
  if (!configured()) redirect("/");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/oversikt");
  return <main className="login-page"><section className="login-intro"><div className="brand"><span className="brand-icon">D</span><span>DRIFTSSJEKK</span></div><div><p className="eyebrow">Arbeidsverktøy for varehus</p><h1>God drift starter med god oversikt.</h1><p>Dokumenter besøk, følg utviklingen og gjør det enklere å prioritere riktig.</p></div><p className="small">Kun for inviterte brukere</p></section><section className="login-side"><LoginForm /></section></main>;
}
