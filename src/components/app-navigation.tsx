"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarChart3, BookOpen, CalendarDays, ClipboardList, FileText, ListChecks, MoreHorizontal, Plus, Settings, UserPlus, UserRound, Warehouse, X } from "lucide-react";

type Permissions = { operations: boolean; fullOperations?: boolean; monthly: boolean; admin?: boolean; storeId?: string };

function createLinks({ operations, fullOperations, monthly, admin, storeId }: Permissions) {
  const store = storeId ? `&store=${encodeURIComponent(storeId)}` : "";
  return [
    ...(operations ? [{ href: `/rapporter/ny?type=inspection${store}`, label: "Uanmeldt konseptsjekk", detail: "Vurder et varehus", icon: ClipboardList }] : []),
    ...(monthly ? [{ href: `/rapporter/ny?type=self_check${store}`, label: "Månedlig driftsgjennomgang", detail: "Vurder varehuset for intern progresjon", icon: FileText }] : []),
    ...(fullOperations ? [{ href: "/runder/ny", label: "Konseptsjekkrunde", detail: "Planlegg flere varehusbesøk", icon: Plus }] : []),
    ...(operations ? [{ href: "/samlinger/ny", label: "Samling for varehussjefer", detail: "Inviter til en felles konseptrunde", icon: CalendarDays }] : []),
    ...(admin ? [{ href: "/administrasjon", label: "Ny bruker", detail: "Opprett bruker og tildel tilgang", icon: UserPlus }] : []),
  ];
}

export function StartNewMenu(props: Permissions & { sidebar?: boolean }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpenAt(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenAt(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const links = createLinks(props);
  if (!links.length) return null;
  return <div className={`start-new ${props.sidebar ? "start-new-sidebar" : ""}`} ref={root}>
    <button type="button" className={`button primary start-new-trigger${props.sidebar ? " sidebar-start-button" : ""}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpenAt(open ? null : pathname)}><Plus size={18}/><span>Start ny</span></button>
    {open && <div className="start-new-menu" role="menu" aria-label="Start ny">{links.map(({ href, label, detail, icon: Icon }) => <Link role="menuitem" href={href} key={href} onClick={() => setOpenAt(null)}><Icon size={19} aria-hidden="true"/><span><strong>{label}</strong><small>{detail}</small></span></Link>)}</div>}
  </div>;
}

export function MobileNavigation(props: Permissions) {
  const pathname = usePathname();
  const [menu, setMenu] = useState<{ panel: "new" | "more"; path: string } | null>(null);
  const panel = menu?.path === pathname ? menu.panel : null;
  useEffect(() => {
    if (!panel) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [panel]);
  const newLinks = createLinks(props);
  const moreLinks = [
    ...(props.fullOperations ? [{ href: "/runder", label: "Konseptsjekkrunder", icon: ClipboardList }] : []),
    { href: "/samlinger", label: "Samlinger", icon: CalendarDays },
    { href: "/oppfolging", label: "Oppfølging", icon: ListChecks },
    { href: "/kriterier", label: "Kriterier", icon: BookOpen },
    { href: "/min-konto", label: "Min konto", icon: UserRound },
    ...(props.admin ? [{ href: "/administrasjon", label: "Administrasjon", icon: Settings }] : []),
  ];
  return <>
    {panel && <><button type="button" className="mobile-menu-backdrop" aria-label="Lukk meny" onClick={() => setMenu(null)}/><div className="mobile-menu-sheet" role="dialog" aria-modal="true" aria-label={panel === "new" ? "Start ny" : "Flere sider"}><div className="mobile-sheet-heading"><h2>{panel === "new" ? "Start ny" : "Mer"}</h2><button type="button" aria-label="Lukk meny" onClick={() => setMenu(null)}><X size={20}/></button></div><div className="mobile-sheet-links">{panel === "new" ? newLinks.map(({ href, label, detail, icon: Icon }) => <Link href={href} key={href} onClick={() => setMenu(null)}><Icon size={21}/><span><strong>{label}</strong><small>{detail}</small></span></Link>) : moreLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={href} onClick={() => setMenu(null)}><Icon size={21}/><strong>{label}</strong></Link>)}</div></div></>}
    <nav className="mobile-nav app-mobile-nav" aria-label="Mobilmeny">
      <Link href="/oversikt" aria-current={pathname.startsWith("/oversikt") ? "page" : undefined}><BarChart3 size={20}/><span>Oversikt</span></Link>
      <Link href="/varehus" aria-current={pathname.startsWith("/varehus") ? "page" : undefined}><Warehouse size={20}/><span>Varehus</span></Link>
      <button type="button" className="mobile-start-tab" aria-expanded={panel === "new"} onClick={() => setMenu(panel === "new" ? null : { panel: "new", path: pathname })}><Plus size={20}/><span>Start ny</span></button>
      <Link href="/rapporter" aria-current={pathname.startsWith("/rapporter") ? "page" : undefined}><FileText size={20}/><span>Rapporter</span></Link>
      <button type="button" aria-expanded={panel === "more"} onClick={() => setMenu(panel === "more" ? null : { panel: "more", path: pathname })}><MoreHorizontal size={20}/><span>Mer</span></button>
    </nav>
  </>;
}
