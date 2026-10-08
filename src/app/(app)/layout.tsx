import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ClipboardList, Warehouse, FileText, ListChecks, Settings, LogOut, BookOpen } from "lucide-react";
import { getContext, isOperations } from "@/lib/auth";
import { MobileNavigation, StartNewMenu } from "@/components/app-navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { memberships, name, supabase } = await getContext();
  async function signOut() { "use server"; const { supabase } = await getContext(); await supabase.auth.signOut(); redirect("/login"); }
  if (!memberships.length) return <main className="setup-page"><div className="setup-card"><h1>Ingen tilgang ennå</h1><p>Du er logget inn, men har ingen tildelt rolle. Kontakt administrator.</p><form action={signOut}><button className="button">Logg ut</button></form></div></main>;

  const operations = isOperations(memberships);
  const monthly = memberships.some((m) => m.role === "store_manager");
  const admin = memberships.some((m) => m.role === "cooperative_admin");
  const primaryLinks = [
    { href: "/oversikt", label: "Oversikt", icon: BarChart3 },
    { href: "/varehus", label: "Varehus", icon: Warehouse },
    { href: "/rapporter", label: "Rapporter", icon: FileText },
    { href: "/oppfolging", label: "Oppfølging", icon: ListChecks },
  ];
  const secondaryLinks = [
    ...(operations ? [{ href: "/runder", label: "Konseptsjekkrunder", icon: ClipboardList }] : []),
    { href: "/kriterier", label: "Kriterier", icon: BookOpen },
    ...(admin ? [{ href: "/administrasjon", label: "Administrasjon", icon: Settings }] : []),
  ];
  const { data: cooperatives } = await supabase.from("cooperatives").select("name").limit(1);
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/oversikt" className="brand"><span className="brand-icon">D</span><span>DRIFTSSJEKK<small>Arbeidsverktøy</small></span></Link>
      <div className="workspace-label">ARBEIDSOMRÅDE</div>
      <div className="coop-chip"><span className="coop-dot" />{cooperatives?.[0]?.name || "Ditt samvirkelag"}</div>
      <StartNewMenu operations={operations} monthly={monthly} admin={admin} sidebar />
      <nav aria-label="Hovedmeny">{primaryLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={19} strokeWidth={1.9}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-section-label">FLERE SIDER</div>
      <nav aria-label="Flere sider">{secondaryLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={19} strokeWidth={1.9}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><div className="user-avatar">{name.charAt(0).toUpperCase()}</div><div className="user-name"><strong>{name}</strong><small>{admin && operations ? "Administrator og drift" : operations ? "Driftssjef" : admin ? "Administrator" : "Varehussjef"}</small></div><form action={signOut}><button className="logout-button" title="Logg ut" aria-label="Logg ut"><LogOut size={18}/><span>Logg ut</span></button></form></div>
    </aside>
    <div className="mobile-top mobile-top-auth"><Link href="/oversikt" className="brand"><span className="brand-icon">D</span><span>DRIFTSSJEKK</span></Link><form action={signOut}><button className="mobile-logout" type="submit"><LogOut size={17}/><span>Logg ut</span></button></form></div>
    <main className="main-content">{children}</main>
    <MobileNavigation operations={operations} monthly={monthly} admin={admin}/>
  </div>;
}
