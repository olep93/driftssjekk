import Link from "next/link";
import { redirect } from "next/navigation";
import { configured, createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (!configured()) return <main className="setup-page"><div className="setup-card"><div className="brand-icon">D</div><p className="eyebrow">Oppsett kreves</p><h1>Driftssjekk</h1><p>Appen er klar for å kobles til Supabase. Legg inn variablene fra <code>.env.example</code>, kjør migrasjonen og opprett første administrator.</p><p>Se <Link href="https://github.com/olep93/driftssjekk">README</Link> for oppsett. Dette er ingen demodatabase eller produksjonstilkobling.</p></div></main>;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims?.sub ? "/oversikt" : "/login");
}
