import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ClipboardList, Warehouse, FileText, ListChecks, Settings, LogOut } from "lucide-react";
import { getContext, isOperations } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { memberships, name, supabase } = await getContext();
  async function signOut() { "use server"; const { supabase } = await getContext(); await supabase.auth.signOut(); redirect("/login"); }
  if (!memberships.length) return <main className="setup-page"><div className="setup-card"><h1>Ingen tilgang ennå</h1><p>Du er logget inn, men har ingen tildelt rolle. Kontakt administrator.</p><form action={signOut}><button className="button">Logg ut</button></form></div></main>;
  const operations = isOperations(memberships);
  const admin = memberships.some((m) => m.role === "cooperative_admin");
  const links = [
    { href: "/oversikt", label: "Oversikt", icon: BarChart3 },
    ...(operations ? [{ href: "/runder", label: "Runder", icon: ClipboardList }] : []),
    { href: "/varehus", label: "Varehus", icon: Warehouse },
    { href: "/rapporter", label: "Rapporter", icon: FileText },
    { href: "/oppfolging", label: "Oppfølging", icon: ListChecks },
    ...(admin ? [{ href: "/administrasjon", label: "Administrasjon", icon: Settings }] : []),
  ];
  const { data: cooperatives } = await supabase.from("cooperatives").select("name").limit(1);
  return <div className="app-shell"><aside className="sidebar"><Link href="/oversikt" className="brand"><span className="brand-icon">D</span><span>DRIFTSSJEKK<small>Arbeidsverktøy</small></span></Link><div className="workspace-label">ARBEIDSOMRÅDE</div><div className="coop-chip"><span className="coop-dot" />{cooperatives?.[0]?.name || "Ditt samvirkelag"}</div><nav aria-label="Hovedmeny">{links.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={19} strokeWidth={1.9} /><span>{label}</span></Link>)}</nav><div className="sidebar-bottom"><div className="user-avatar">{name.charAt(0).toUpperCase()}</div><div className="user-name"><strong>{name}</strong><small>{operations ? "Driftssjef" : admin ? "Administrator" : "Varehussjef"}</small></div><form action={signOut}><button title="Logg ut" aria-label="Logg ut"><LogOut size={18} /></button></form></div></aside><div className="mobile-top"><Link href="/oversikt" className="brand"><span className="brand-icon">D</span><span>DRIFTSSJEKK</span></Link></div><main className="main-content">{children}</main><nav className="mobile-nav" aria-label="Mobilmeny">{links.slice(0, 5).map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={20} /><span>{label}</span></Link>)}</nav></div>;
}
