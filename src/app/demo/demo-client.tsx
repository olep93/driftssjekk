"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CalendarRange, ClipboardCheck, FileText, LayoutDashboard, RotateCcw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { CriteriaReference } from "@/components/criteria-reference";
import { conceptBand, conceptLabel } from "@/lib/criteria";
import type { LucideIcon } from "lucide-react";
import { areas, formatScore, totalFromQuarters } from "@/lib/scoring";
import { DemoAreaPhotos, type DemoPhoto } from "./demo-area-photos";

type Report = { store: string; scores: [number, number, number, number]; date: string; comment: string };
type Round = { name: string; period: string; status: string; reports: Report[] };
type View = "oversikt" | "runder" | "rapporter" | "vurdering" | "kriterier";

const rounds: Round[] = [
  { name: "Driftsrunde 1 – høst 2026", period: "September–oktober 2026", status: "Avsluttet", reports: [
    { store: "Tønsberg", scores: [32, 31, 29, 28], date: "15. sep. 2026", comment: "God flyt i Drive-In. Varemottaket bør følges opp." },
    { store: "Mjøndalen", scores: [30, 29, 31, 27], date: "16. sep. 2026", comment: "Ryddig uteområde og tydelige rutiner." },
    { store: "Skien", scores: [27, 30, 28, 26], date: "17. sep. 2026", comment: "Tiltak er registrert for varemottak." },
    { store: "Sandefjord", scores: [31, 32, 29, 30], date: "18. sep. 2026", comment: "Jevnt godt resultat i alle områder." },
  ] },
  { name: "Driftsrunde 2 – vinter 2027", period: "Januar–mars 2027", status: "Avsluttet", reports: [
    { store: "Tønsberg", scores: [34, 34, 35, 31], date: "15. feb. 2027", comment: "Bedre orden og vareflyt." },
    { store: "Mjøndalen", scores: [32, 31, 32, 30], date: "16. feb. 2027", comment: "Stabil framgang siden forrige runde." },
    { store: "Skien", scores: [29, 31, 30, 28], date: "17. feb. 2027", comment: "Tiltak i varemottak er under oppfølging." },
    { store: "Sandefjord", scores: [33, 33, 31, 31], date: "18. feb. 2027", comment: "God gjennomføring av driftsrutiner." },
    { store: "Kongsberg", scores: [28, 29, 27, 26], date: "19. feb. 2027", comment: "Første sammenlignbare resultat for varehuset." },
  ] },
  { name: "Driftsrunde 3 – vår 2027", period: "April–juni 2027", status: "Pågår", reports: [
    { store: "Tønsberg", scores: [35, 34, 35, 32], date: "15. mai 2027", comment: "Fortsatt god utvikling." },
    { store: "Mjøndalen", scores: [33, 32, 32, 31], date: "16. mai 2027", comment: "Forbedring i Drive-In og varemottak." },
  ] },
];

const stores = ["Tønsberg", "Mjøndalen", "Skien", "Sandefjord", "Kongsberg"];
const nav: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "oversikt", label: "Oversikt", icon: LayoutDashboard },
  { id: "runder", label: "Konseptsjekker", icon: CalendarRange },
  { id: "rapporter", label: "Rapporter", icon: FileText },
  { id: "vurdering", label: "Prøv konseptsjekk", icon: ClipboardCheck },
  { id: "kriterier", label: "Kriterier", icon: BookOpen },
];

function total(report: Report) { return totalFromQuarters(report.scores)!; }
function mean(reports: Report[]) { return reports.length ? reports.reduce((sum, report) => sum + total(report), 0) / reports.length : 0; }
function pill(value: number) { return <span className={`score-pill ${conceptBand(value)}`} title={conceptLabel(value)}>{formatScore(value)}</span>; }

export function DemoClient() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const view = (["runder","rapporter","vurdering","kriterier"].includes(segments[1]) ? segments[1] : "oversikt") as View;
  const selectedStore = view === "rapporter" && segments[3] ? decodeURIComponent(segments[3]) : null;
  const [roundIndex, setRoundIndex] = useState(1);
  const [draftScores, setDraftScores] = useState<[number, number, number, number]>([32, 30, 28, 29]);
  const [comments, setComments] = useState(["God orden og tydelig merking.", "", "", "Varemottaket bør følges opp."]);
  const [photosByArea, setPhotosByArea] = useState<DemoPhoto[][]>(() => areas.map(() => []));
  const [photoErrors, setPhotoErrors] = useState<string[]>(() => areas.map(() => ""));
  const photoUrls = useRef(new Set<string>());
  const activeRoundIndex = view === "rapporter" && segments[2] && Number.isInteger(Number(segments[2])) && rounds[Number(segments[2])] ? Number(segments[2]) : roundIndex;
  const round = rounds[activeRoundIndex];
  const sorted = useMemo(() => [...round.reports].sort((a, b) => total(b) - total(a)), [round]);
  const activeReport = selectedStore ? round.reports.find((report) => report.store === selectedStore) : null;
  const draftTotal = totalFromQuarters(draftScores);
  const previous = activeRoundIndex > 0 ? rounds[activeRoundIndex - 1] : null;

  function updateScore(index: number, next: number) {
    if (!Number.isInteger(next) || next < 4 || next > 40) return;
    setDraftScores((current) => current.map((value, position) => position === index ? next : value) as [number, number, number, number]);
  }
  useEffect(() => {
    const urls = photoUrls.current;
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);
  function addPhotos(index: number, selected: FileList | null) {
    if (!selected?.length) return;
    const files = Array.from(selected);
    const valid = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size > 0 && file.size <= 10_485_760);
    const available = Math.max(0, 20 - photosByArea[index].length);
    const added = valid.slice(0, available).map((file) => {
      const url = URL.createObjectURL(file);
      photoUrls.current.add(url);
      return { id: crypto.randomUUID(), name: file.name, url, caption: "" };
    });
    setPhotosByArea((current) => current.map((photos, position) => position === index ? [...photos, ...added] : photos));
    const messages: string[] = [];
    if (valid.length !== files.length) messages.push("Noen filer ble hoppet over. Bruk JPEG, PNG eller WebP på maks 10 MB per bilde.");
    if (valid.length > available) messages.push("Maksimalt 20 bilder per område.");
    setPhotoErrors((current) => current.map((message, position) => position === index ? messages.join(" ") : message));
  }
  function updatePhotoCaption(index: number, id: string, caption: string) {
    setPhotosByArea((current) => current.map((photos, position) => position === index ? photos.map((photo) => photo.id === id ? { ...photo, caption } : photo) : photos));
  }
  function removePhoto(index: number, id: string) {
    const photo = photosByArea[index].find((item) => item.id === id);
    if (photo) { URL.revokeObjectURL(photo.url); photoUrls.current.delete(photo.url); }
    setPhotosByArea((current) => current.map((photos, position) => position === index ? photos.filter((item) => item.id !== id) : photos));
    setPhotoErrors((current) => current.map((message, position) => position === index ? "" : message));
  }
  function resetDemo() {
    photoUrls.current.forEach((url) => URL.revokeObjectURL(url));
    photoUrls.current.clear();
    setPhotosByArea(areas.map(() => []));
    setPhotoErrors(areas.map(() => ""));
    setDraftScores([32, 30, 28, 29]);
    setComments(["God orden og tydelig merking.", "", "", "Varemottaket bør følges opp."]);
  }
  function switchView(next: View) { router.push(next === "oversikt" ? "/demo" : next === "rapporter" ? `/demo/rapporter/${roundIndex}` : `/demo/${next}`); }

  return <div className="app-shell">
    <aside className="sidebar demo-sidebar">
      <div className="brand"><span className="brand-icon">D</span><span>DRIFTSSJEKK<small>PRØVEDEMO</small></span></div>
      <div className="workspace-label">ARBEIDSOMRÅDE</div>
      <div className="coop-chip"><span className="coop-dot" /> Coop Sørøst</div>
      <nav aria-label="Prøvedemo">
        {nav.map((item) => <button key={item.id} className={`demo-nav-button ${view === item.id ? "selected" : ""}`} onClick={() => switchView(item.id)} aria-current={view === item.id ? "page" : undefined}><item.icon size={18} strokeWidth={1.8} aria-hidden="true"/>{item.label}</button>)}
      </nav>
      <div className="sidebar-bottom"><span className="user-avatar">D</span><span className="user-name"><strong>Demobruker</strong></span></div>
    </aside>
    <div className="mobile-top"><div className="brand"><span className="brand-icon">D</span> DRIFTSSJEKK</div></div>
    <main className="main-content demo-main">
      <div className="demo-banner"><strong>Fiktive data</strong><span>Endringer og bilder lagres ikke her. <Link href="/login">Logg inn for å lagre en test i Tønsberg.</Link></span></div>
      {view !== "vurdering" && <div className="filters demo-round-filter"><label htmlFor="demo-round">Vis runde</label><select id="demo-round" value={roundIndex} onChange={(event) => { const next=Number(event.target.value); setRoundIndex(next); if(view === "rapporter") router.push(`/demo/rapporter/${next}`); }}>{rounds.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></div>}

      {view === "oversikt" && <>
        <header className="page-heading"><div><p className="eyebrow">Driftsoversikt</p><h1>God oversikt over varehusene</h1><p className="muted">{round.name} · {round.period}</p></div><div className="page-actions"><button className="button primary" onClick={() => switchView("vurdering")}>Prøv en vurdering</button></div></header>
        <div className="grid-4">
          <div className="stat-card"><span className="label">Gjennomsnitt</span><strong className="value">{formatScore(mean(round.reports))}</strong><span className="hint">Alle publiserte vurderinger i runden</span></div>
          <div className="stat-card"><span className="label">Dekning</span><strong className="value">{round.reports.length}/{stores.length}</strong><span className="hint">Varehus med publisert konseptsjekk</span></div>
          <div className="stat-card"><span className="label">Høyeste resultat</span><strong className="value">{formatScore(total(sorted[0]))}</strong><span className="hint">{sorted[0].store}</span></div>
          <div className="stat-card"><span className="label">Rundestatus</span><strong className="value demo-status-value">{round.status}</strong><span className="hint">{round.period}</span></div>
        </div>
        <section className="panel"><div className="panel-header"><h2>Rangering</h2><button className="text-button" onClick={() => switchView("rapporter")}>Se rapporter →</button></div><div className="table-wrap"><table><thead><tr><th>Plass</th><th>Varehus</th><th>Konseptsjekk</th><th>Endring fra forrige runde</th></tr></thead><tbody>{sorted.map((report, index) => { const prior = previous?.reports.find((row) => row.store === report.store); const change = prior ? total(report) - total(prior) : null; return <tr key={report.store}><td className="rank">{index + 1}</td><td><button className="demo-link" onClick={() => { router.push(`/demo/rapporter/${activeRoundIndex}/${encodeURIComponent(report.store)}`); }}>{report.store}</button></td><td>{pill(total(report))}</td><td>{change === null ? "Ingen sammenligning" : `${change >= 0 ? "+" : ""}${formatScore(change)}`}</td></tr>; })}</tbody></table></div></section>
        <section className="panel"><div className="panel-header"><h2>Områder</h2><span className="muted small">Gjennomsnitt på tvers av publiserte vurderinger</span></div><div className="demo-area-grid">{areas.map((area, index) => { const average = round.reports.reduce((sum, report) => sum + report.scores[index] / 4, 0) / round.reports.length; return <div className="demo-area-summary" key={area.key}><span>{area.label}</span><strong>{formatScore(average)}</strong><div className="progress-track"><div className="progress-fill" style={{ width: `${average * 10}%` }} /></div></div>; })}</div></section>
      </>}

      {view === "runder" && <><header className="page-heading"><div><p className="eyebrow">Konseptsjekkrunder</p><h1>Uanmeldte konseptsjekker</h1><p className="muted">Sammenlign runder og se hvilke varehus som er vurdert.</p></div></header><div className="grid-2">{rounds.map((item, index) => <button className={`demo-round-card ${roundIndex === index ? "selected" : ""}`} key={item.name} onClick={() => setRoundIndex(index)}><div className="panel-header"><h2>{item.name}</h2><span className={`status ${item.status === "Pågår" ? "active" : "closed"}`}>{item.status}</span></div><p className="muted">{item.period}</p><strong>{item.reports.length} av {stores.length} varehus</strong><div className="progress-track"><div className="progress-fill" style={{ width: `${item.reports.length / stores.length * 100}%` }} /></div></button>)}</div><section className="panel"><div className="panel-header"><h2>{round.name}</h2><span className="muted small">{round.reports.length} vurdert</span></div><div className="demo-store-grid">{stores.map((store) => { const report = round.reports.find((item) => item.store === store); return <div className="demo-store" key={store}><strong>{store}</strong>{report ? pill(total(report)) : <span className="status">Ikke vurdert</span>}</div>; })}</div></section></>}

      {view === "rapporter" && <><header className="page-heading"><div><p className="eyebrow">Rapporter</p><h1>{activeReport ? activeReport.store : "Publiserte vurderinger"}</h1><p className="muted">{activeReport ? `${round.name} · ${activeReport.date}` : `Rapporter fra ${round.name.toLowerCase()}.`}</p></div>{activeReport && <div className="page-actions"><button className="button" onClick={() => router.push(`/demo/rapporter/${activeRoundIndex}`)}>← Tilbake til listen</button></div>}</header>{activeReport ? <article className="report-paper"><div className="report-top"><div><p className="eyebrow">Konseptsjekk</p><h2>{activeReport.store}</h2><p className="muted">Coop Sørøst · {activeReport.date}</p></div>{pill(total(activeReport))}</div><p>{activeReport.comment}</p>{areas.map((area, index) => <section className="report-area" key={area.key}><h3>{area.label}{pill(activeReport.scores[index] / 4)}</h3></section>)}</article> : <section className="panel"><div className="table-wrap"><table><thead><tr><th>Varehus</th><th>Besøksdato</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{sorted.map((report) => <tr key={report.store}><td>{report.store}</td><td>{report.date}</td><td>{pill(total(report))}</td><td><span className="status published">Publisert</span></td><td><button className="demo-link" onClick={() => router.push(`/demo/rapporter/${activeRoundIndex}/${encodeURIComponent(report.store)}`)}>Åpne →</button></td></tr>)}</tbody></table></div></section>}</>}

      {view === "kriterier" && <><header className="page-heading"><div><p className="eyebrow">Oppslagsverk</p><h1>Vurderingskriterier</h1></div></header><CriteriaReference /></>}
      {view === "vurdering" && <>
        <header className="page-heading demo-assessment-heading"><div><h1>Prøv en uanmeldt konseptsjekk</h1></div></header>
        <div className="editor-grid demo-assessment-layout"><div className="demo-assessment-areas">{areas.map((area, index) => <section className="demo-assessment-card" key={area.key}>
          <div className="demo-assessment-head"><div className="demo-assessment-title"><span className="demo-area-number">{String(index + 1).padStart(2, "0")}</span><h2>{area.label}</h2></div><div className="demo-assessment-score"><span>Karakter</span><output htmlFor={`demo-score-${index}`}>{formatScore(draftScores[index] / 4)}<small> / 10</small></output></div></div>
          <div className="demo-range-field"><div className="demo-range-control"><button type="button" aria-label={`Senk karakter for ${area.label}`} disabled={draftScores[index] <= 4} onClick={() => updateScore(index, draftScores[index] - 1)}>−</button><input id={`demo-score-${index}`} type="range" min={4} max={40} step={1} value={draftScores[index]} onChange={(event) => updateScore(index, Number(event.target.value))} aria-label={`Karakter for ${area.label}`} aria-valuetext={`${formatScore(draftScores[index] / 4)} av 10`} style={{background:`linear-gradient(to right, var(--navy) ${(draftScores[index] - 4) / 36 * 100}%, #e3e9ef ${(draftScores[index] - 4) / 36 * 100}%)`}}/><button type="button" aria-label={`Øk karakter for ${area.label}`} disabled={draftScores[index] >= 40} onClick={() => updateScore(index, draftScores[index] + 1)}>+</button></div><div className="demo-range-scale"><span>1,00</span><span>10,00</span></div></div>
          <label className="demo-comment-field"><strong>Kommentar</strong><textarea rows={2} value={comments[index]} onChange={(event) => setComments((current) => current.map((value, position) => position === index ? event.target.value : value))} placeholder="Skriv en kort observasjon" /></label>
          <DemoAreaPhotos areaLabel={area.label} photos={photosByArea[index]} error={photoErrors[index]} onAdd={(files) => addPhotos(index, files)} onCaptionChange={(id, caption) => updatePhotoCaption(index, id, caption)} onRemove={(id) => removePhoto(index, id)} />
        </section>)}</div><aside className="demo-summary-card"><h2>Samlet karakter</h2><div className="demo-summary-score">{formatScore(draftTotal)}<span> / 10</span></div><div className="demo-summary-list">{areas.map((area, index) => <div key={area.key}><span>{area.label}</span><strong>{formatScore(draftScores[index] / 4)}</strong></div>)}</div><Link className="button primary" href="/login" style={{width:"100%",marginTop:20}}>Logg inn og lagre rapport</Link><button className="button demo-reset-button" onClick={resetDemo}><RotateCcw size={15}/> Start på nytt</button></aside></div>
      </>}
    </main>
    <nav className="mobile-nav demo-mobile-nav" aria-label="Prøvedemo mobil">{nav.map((item) => <button key={item.id} className={view === item.id ? "selected" : ""} onClick={() => switchView(item.id)}><item.icon size={17} strokeWidth={1.8} aria-hidden="true"/>{item.id === "runder" ? "Runder" : item.id === "vurdering" ? "Prøv sjekk" : item.label}</button>)}</nav>
  </div>;
}
