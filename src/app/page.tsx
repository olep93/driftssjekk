import Link from "next/link";
import { redirect } from "next/navigation";
import { configured, createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (!configured()) return <main className="setup-page"><div className="setup-card"><div className="brand-icon">D</div><p className="eyebrow">Prøvedemo</p><h1>Driftssjekk</h1><p>Utforsk løsningen med fiktive data og prøv en vurdering. Endringer i prøvevisningen blir ikke lagret.</p><p><Link className="button primary" href="/demo">Åpne prøvevisning →</Link></p><p className="muted small">Database og innlogging kobles opp separat. <Link href="https://github.com/olep93/driftssjekk">Se prosjektet på GitHub</Link>.</p></div></main>;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims?.sub ? "/oversikt" : "/login");
}
