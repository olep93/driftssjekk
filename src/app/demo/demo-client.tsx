"use client";

import { useMemo, useState } from "react";
import { areas, formatScore, totalFromQuarters } from "@/lib/scoring";

type Report = { store: string; scores: [number, number, number, number]; date: string; comment: string };
type Round = { name: string; period: string; status: string; reports: Report[] };
type View = "oversikt" | "runder" | "rapporter" | "vurdering";

const rounds: Round[] = [
  { name: "Driftsrunde 1 – høst 2026", period: "September–oktober 2026", status: "Avsluttet", reports: [
    { store: "Tønsberg", scores: [32, 31, 29, 28], date: "15. sep. 2026", comment: "Fiktiv vurdering: god flyt i Drive-In. Varemottaket bør følges opp." },
    { store: "Mjøndalen", scores: [30, 29, 31, 27], date: "16. sep. 2026", comment: "Fiktiv vurdering: ryddig uteområde og tydelige rutiner." },
    { store: "Skien", scores: [27, 30, 28, 26], date: "17. sep. 2026", comment: "Fiktiv vurdering: tiltak er registrert for varemottak." },
    { store: "Sandefjord", scores: [31, 32, 29, 30], date: "18. sep. 2026", comment: "Fiktiv vurdering: jevnt godt resultat i alle områder." },
  ] },
  { name: "Driftsrunde 2 – vinter 2027", period: "Januar–mars 2027", status: "Avsluttet", reports: [
    { store: "Tønsberg", scores: [34, 34, 35, 31], date: "15. feb. 2027", comment: "Fiktiv korrigert vurdering: bedre orden og vareflyt." },
    { store: "Mjøndalen", scores: [32, 31, 32, 30], date: "16. feb. 2027", comment: "Fiktiv vurdering: stabil framgang siden forrige runde." },
    { store: "Skien", scores: [29, 31, 30, 28], date: "17. feb. 2027", comment: "Fiktiv vurdering: tiltak i varemottak er under oppfølging." },
    { store: "Sandefjord", scores: [33, 33, 31, 31], date: "18. feb. 2027", comment: "Fiktiv vurdering: god gjennomføring av driftsrutiner." },
    { store: "Kongsberg", scores: [28, 29, 27, 26], date: "19. feb. 2027", comment: "Fiktiv vurdering: første sammenlignbare resultat i demoen." },
  ] },
  { name: "Driftsrunde 3 – vår 2027", period: "April–juni 2027", status: "Pågår", reports: [
    { store: "Tønsberg", scores: [35, 34, 35, 32], date: "15. mai 2027", comment: "Fiktiv vurdering: fortsatt god utvikling." },
    { store: "Mjøndalen", scores: [33, 32, 32, 31], date: "16. mai 2027", comment: "Fiktiv vurdering: forbedring i Drive-In og varemottak." },
  ] },
];

const stores = ["Tønsberg", "Mjøndalen", "Skien", "Sandefjord", "Kongsberg"];
const nav: { id: View; label: string; icon: string }[] = [
  { id: "oversikt", label: "Oversikt", icon: "▦" },
  { id: "runder", label: "Runder", icon: "◷" },
  { id: "rapporter", label: "Rapporter", icon: "▤" },
  { id: "vurdering", label: "Prøv vurdering", icon: "✎" },
];

function total(report: Report) { return totalFromQuarters(report.scores)!; }
function mean(reports: Report[]) { return reports.length ? reports.reduce((sum, report) => sum + total(report), 0) / reports.length : 0; }
function pill(value: number) { return <span className={`score-pill ${value < 5 ? "low" : value < 7 ? "mid" : ""}`}>{formatScore(value)}</span>; }

export function DemoClient() {
  const [view, setView] = useState<View>("oversikt");
  const [roundIndex, setRoundIndex] = useState(1);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [draftScores, setDraftScores] = useState<[number, number, number, number]>([32, 30, 28, 29]);
  const [comments, setComments] = useState(["God orden og tydelig merking.", "", "", "Varemottaket bør følges opp."]);
  const round = rounds[roundIndex];
  const sorted = useMemo(() => [...round.reports].sort((a, b) => total(b) - total(a)), [round]);
  const activeReport = selectedStore ? round.reports.find((report) => report.store === selectedStore) : null;
  const draftTotal = totalFromQuarters(draftScores);
  const previous = roundIndex > 0 ? rounds[roundIndex - 1] : null;

  function updateScore(index: number, next: number) {
    if (!Number.isInteger(next) || next < 4 || next > 40) return;
    setDraftScores((current) => current.map((value, position) => position === index ? next : value) as [number, number, number, number]);
  }
  function switchView(next: View) { setView(next); setSelectedStore(null); }

  return <div className="app-shell">
    <aside className="sidebar demo-sidebar">
      <div className="brand"><span className="brand-icon">D</span><span>DRIFTSSJEKK<small>PRØVEDEMO</small></span></div>
      <div className="workspace-label">ARBEIDSOMRÅDE</div>
      <div className="coop-chip"><span className="coop-dot" /> Coop Sørøst <span className="small">(fiktivt)</span></div>
      <nav aria-label="Prøvedemo">
        {nav.map((item) => <button key={item.id} className={`demo-nav-button ${view === item.id ? "selected" : ""}`} onClick={() => switchView(item.id)} aria-current={view === item.id ? "page" : undefined}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
      </nav>
      <div className="sidebar-bottom"><span className="user-avatar">D</span><span className="user-name"><strong>Demobruker</strong><small>Fiktive data</small></span></div>
    </aside>
    <div className="mobile-top"><div className="brand"><span className="brand-icon">D</span> DRIFTSSJEKK</div></div>
    <main className="main-content demo-main">
      <div className="demo-banner"><strong>Prøvedemo med fiktive data</strong><span>Du kan utforske og endre vurderinger her. Endringene lagres ikke.</span></div>
      {view !== "vurdering" && <div className="filters demo-round-filter"><label htmlFor="demo-round">Vis runde</label><select id="demo-round" value={roundIndex} onChange={(event) => { setRoundIndex(Number(event.target.value)); setSelectedStore(null); }}>{rounds.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></div>}

      {view === "oversikt" && <>
        <header className="page-heading"><div><p className="eyebrow">Driftsoversikt</p><h1>God oversikt over varehusene</h1><p className="muted">{round.name} · {round.period}</p></div><div className="page-actions"><button className="button primary" onClick={() => switchView("vurdering")}>Prøv en vurdering</button></div></header>
        <div className="grid-4">
          <div className="stat-card"><span className="label">Gjennomsnitt</span><strong className="value">{formatScore(mean(round.reports))}</strong><span className="hint">Alle publiserte vurderinger i runden</span></div>
          <div className="stat-card"><span className="label">Dekning</span><strong className="value">{round.reports.length}/{stores.length}</strong><span className="hint">Varehus med publisert driftssjekk</span></div>
          <div className="stat-card"><span className="label">Høyeste resultat</span><strong className="value">{formatScore(total(sorted[0]))}</strong><span className="hint">{sorted[0].store}</span></div>
          <div className="stat-card"><span className="label">Rundestatus</span><strong className="value demo-status-value">{round.status}</strong><span className="hint">{round.period}</span></div>
        </div>
        <section className="panel"><div className="panel-header"><h2>Rangering</h2><button className="text-button" onClick={() => switchView("rapporter")}>Se rapporter →</button></div><div className="table-wrap"><table><thead><tr><th>Plass</th><th>Varehus</th><th>Driftssjekk</th><th>Endring fra forrige runde</th></tr></thead><tbody>{sorted.map((report, index) => { const prior = previous?.reports.find((row) => row.store === report.store); const change = prior ? total(report) - total(prior) : null; return <tr key={report.store}><td className="rank">{index + 1}</td><td><button className="demo-link" onClick={() => { setSelectedStore(report.store); setView("rapporter"); }}>{report.store}</button></td><td>{pill(total(report))}</td><td>{change === null ? "Ingen sammenligning" : `${change >= 0 ? "+" : ""}${formatScore(change)}`}</td></tr>; })}</tbody></table></div></section>
        <section className="panel"><div className="panel-header"><h2>Områder</h2><span className="muted small">Gjennomsnitt på tvers av publiserte vurderinger</span></div><div className="demo-area-grid">{areas.map((area, index) => { const average = round.reports.reduce((sum, report) => sum + report.scores[index] / 4, 0) / round.reports.length; return <div className="demo-area-summary" key={area.key}><span>{area.label}</span><strong>{formatScore(average)}</strong><div className="progress-track"><div className="progress-fill" style={{ width: `${average * 10}%` }} /></div></div>; })}</div></section>
      </>}

      {view === "runder" && <><header className="page-heading"><div><p className="eyebrow">Driftsrunder</p><h1>Runder og dekning</h1><p className="muted">Sammenlign runder og se hvilke varehus som er vurdert.</p></div></header><div className="grid-2">{rounds.map((item, index) => <button className={`demo-round-card ${roundIndex === index ? "selected" : ""}`} key={item.name} onClick={() => setRoundIndex(index)}><div className="panel-header"><h2>{item.name}</h2><span className={`status ${item.status === "Pågår" ? "active" : "closed"}`}>{item.status}</span></div><p className="muted">{item.period}</p><strong>{item.reports.length} av {stores.length} varehus</strong><div className="progress-track"><div className="progress-fill" style={{ width: `${item.reports.length / stores.length * 100}%` }} /></div></button>)}</div><section className="panel"><div className="panel-header"><h2>{round.name}</h2><span className="muted small">{round.reports.length} vurdert</span></div><div className="demo-store-grid">{stores.map((store) => { const report = round.reports.find((item) => item.store === store); return <div className="demo-store" key={store}><strong>{store}</strong>{report ? pill(total(report)) : <span className="status">Ikke vurdert</span>}</div>; })}</div></section></>}

      {view === "rapporter" && <><header className="page-heading"><div><p className="eyebrow">Rapporter</p><h1>{activeReport ? activeReport.store : "Publiserte vurderinger"}</h1><p className="muted">{activeReport ? `${round.name} · ${activeReport.date}` : `Fiktive rapporter fra ${round.name.toLowerCase()}.`}</p></div>{activeReport && <div className="page-actions"><button className="button" onClick={() => setSelectedStore(null)}>← Tilbake til listen</button></div>}</header>{activeReport ? <article className="report-paper"><div className="report-top"><div><p className="eyebrow">Driftssjekk</p><h2>{activeReport.store}</h2><p className="muted">Coop Sørøst · {activeReport.date}</p></div>{pill(total(activeReport))}</div><p>{activeReport.comment}</p>{areas.map((area, index) => <section className="report-area" key={area.key}><h3>{area.label}{pill(activeReport.scores[index] / 4)}</h3><p className="muted">Fiktiv observasjon for {area.label.toLowerCase()}.</p></section>)}</article> : <section className="panel"><div className="table-wrap"><table><thead><tr><th>Varehus</th><th>Besøksdato</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{sorted.map((report) => <tr key={report.store}><td>{report.store}</td><td>{report.date}</td><td>{pill(total(report))}</td><td><span className="status published">Publisert</span></td><td><button className="demo-link" onClick={() => setSelectedStore(report.store)}>Åpne →</button></td></tr>)}</tbody></table></div></section>}</>}

      {view === "vurdering" && <><header className="page-heading"><div><p className="eyebrow">Interaktiv prøve</p><h1>Prøv en driftssjekk</h1><p className="muted">Juster karakterene i kvartsteg og se hvordan totalen beregnes.</p></div></header><div className="editor-grid"><div>{areas.map((area, index) => <section className="area-card" key={area.key}><div className="area-heading"><h2>{area.label}</h2>{pill(draftScores[index] / 4)}</div><label className="small muted" htmlFor={`demo-score-${index}`}>Karakter fra 1,00 til 10,00</label><div className="score-control"><button aria-label={`Senk ${area.label}`} onClick={() => updateScore(index, draftScores[index] - 1)}>−</button><input id={`demo-score-${index}`} value={formatScore(draftScores[index] / 4)} readOnly /><button aria-label={`Øk ${area.label}`} onClick={() => updateScore(index, draftScores[index] + 1)}>+</button><span className="score-note">Kvartsteg</span></div><label className="field">Kommentar<textarea value={comments[index]} onChange={(event) => setComments((current) => current.map((value, position) => position === index ? event.target.value : value))} placeholder="Skriv en observasjon" /></label></section>)}</div><aside className="panel summary-box"><p className="eyebrow">Din prøvevurdering</p><h2>Samlet resultat</h2><strong className="demo-total">{formatScore(draftTotal)}</strong><p className="muted small">Summen av de fire karakterene delt på fire. Underliggende kvartsteg beholdes.</p><div className="demo-summary-list">{areas.map((area, index) => <div key={area.key}><span>{area.label}</span><strong>{formatScore(draftScores[index] / 4)}</strong></div>)}</div><button className="button" onClick={() => { setDraftScores([32, 30, 28, 29]); setComments(["God orden og tydelig merking.", "", "", "Varemottaket bør følges opp."]); }}>Tilbakestill prøven</button><p className="muted small demo-save-note">Dette er en prøvevisning. Ingen data blir publisert eller lagret.</p></aside></div></>}
    </main>
    <nav className="mobile-nav" aria-label="Prøvedemo mobil">{nav.map((item) => <button key={item.id} className={view === item.id ? "selected" : ""} onClick={() => switchView(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
  </div>;
}
