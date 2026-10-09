import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, CalendarDays, ClipboardList, Warehouse, FileText, ListChecks, Settings, LogOut, BookOpen, UserRound } from "lucide-react";
import { defaultCooperativeId, getContext, isFullOperations, isOperations } from "@/lib/auth";
import { MobileNavigation, StartNewMenu } from "@/components/app-navigation";
import { StoreFocus } from "@/components/store-focus";
import { focusedStoreId, operationStores } from "@/lib/store-focus";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { memberships, name, supabase, systemAdmin } = await getContext();
  async function signOut() { "use server"; const { supabase } = await getContext(); await supabase.auth.signOut(); redirect("/login"); }
  if (!memberships.length) return <main className="setup-page"><div className="setup-card"><h1>Ingen tilgang ennå</h1><p>Du er logget inn, men har ingen tildelt rolle. Kontakt administrator.</p><form action={signOut}><button className="button">Logg ut</button></form></div></main>;

  const operations = isOperations(memberships);
  const fullOperations = isFullOperations(memberships);
  const monthly = memberships.some((m) => m.role === "store_manager");
  const admin = memberships.some((m) => m.role === "cooperative_admin");
  const primaryLinks = [
    { href: "/oversikt", label: "Oversikt", icon: BarChart3 },
    { href: "/varehus", label: "Varehus", icon: Warehouse },
    { href: "/rapporter", label: "Rapporter", icon: FileText },
    { href: "/oppfolging", label: "Oppfølging", icon: ListChecks },
  ];
  const secondaryLinks = [
    ...(fullOperations ? [{ href: "/runder", label: "Konseptsjekkrunder", icon: ClipboardList }] : []),
    { href: "/samlinger", label: "Samlinger", icon: CalendarDays },
    { href: "/kriterier", label: "Kriterier", icon: BookOpen },
    { href: "/min-konto", label: "Min konto", icon: UserRound },
    ...(admin ? [{ href: "/administrasjon", label: "Administrasjon", icon: Settings }] : []),
  ];
  const [{ data: cooperatives }, { data: availableStores }] = await Promise.all([
    supabase.from("cooperatives").select("id,name"),
    operations ? supabase.from("stores").select("id,cooperative_id,name,active").eq("active",true).order("name") : Promise.resolve({ data: [] }),
  ]);
  const cooperative = cooperatives?.find((item) => item.id === defaultCooperativeId(memberships));
  const focusStores = operationStores(availableStores || [], memberships);
  const focusId = await focusedStoreId(focusStores, memberships);
  const monthlyStoreId = memberships.find((member) => member.role === "store_manager")?.store_id || undefined;
  const storeOptions = focusStores.map((store) => ({ id: store.id, name: store.name, cooperativeName: cooperatives?.find((item) => item.id === store.cooperative_id)?.name || "Samvirkelag" }));
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/oversikt" className="brand"><span className="brand-icon">D</span><span>DRIFTSSJEKK<small>Arbeidsverktøy</small></span></Link>
      <div className="workspace-label">ARBEIDSOMRÅDE</div>
      <div className="coop-chip"><span className="coop-dot" />{cooperative?.name || "Ditt samvirkelag"}</div>
      <StoreFocus key={focusId || "all"} stores={storeOptions} value={focusId}/>
      <StartNewMenu operations={operations} fullOperations={fullOperations} monthly={monthly} monthlyStoreId={monthlyStoreId} admin={admin} storeId={focusId || undefined} sidebar />
      <nav aria-label="Hovedmeny">{primaryLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={19} strokeWidth={1.9}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-section-label">FLERE SIDER</div>
      <nav aria-label="Flere sider">{secondaryLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={19} strokeWidth={1.9}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><Link href="/min-konto" className="account-link" aria-label="Min konto"><div className="user-avatar">{name.charAt(0).toUpperCase()}</div><div className="user-name"><strong>{name}</strong><small>{systemAdmin ? "Systemadministrator" : admin && operations ? "Administrator og drift" : operations ? "Driftssjef" : admin ? "Administrator" : "Varehussjef"}</small></div></Link><form action={signOut}><button className="logout-button" title="Logg ut" aria-label="Logg ut"><LogOut size={18}/><span>Logg ut</span></button></form></div>
    </aside>
    <div className="mobile-top mobile-top-auth"><Link href="/oversikt" className="brand"><span className="brand-icon">D</span><span>DRIFTSSJEKK</span></Link><form action={signOut}><button className="mobile-logout" type="submit"><LogOut size={17}/><span>Logg ut</span></button></form></div>
    {focusStores.length > 1 && <div className="mobile-focus-bar"><StoreFocus key={focusId || "all"} stores={storeOptions} value={focusId} compact/></div>}
    <main className="main-content">{children}</main>
    <MobileNavigation operations={operations} fullOperations={fullOperations} monthly={monthly} monthlyStoreId={monthlyStoreId} admin={admin} storeId={focusId || undefined}/>
  </div>;
}
