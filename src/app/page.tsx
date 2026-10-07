import { redirect } from "next/navigation";
import { configured, createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (!configured()) return <main className="setup-page"><div className="setup-card"><div className="brand-icon">D</div><h1>Driftssjekk</h1><p>Innloggingen er ikke konfigurert. Kontakt administrator.</p></div></main>;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims?.sub ? "/oversikt" : "/login");
}
