import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, isOperations } from "@/lib/auth";
import { areas, formatDate, formatScore } from "@/lib/scoring";
import { PageHeading, Score } from "@/components/ui";
import { StartNewMenu } from "@/components/app-navigation";
import { ProgressChart, Sparkline, TaskChart } from "@/components/progress-charts";
import { reportKindLabel } from "@/lib/report-kind";
import { periodLabels, type Period } from "@/lib/store-progress";
import { canViewStore, loadStoreProgress, parsePeriod } from "@/lib/store-progress-data";

const signed = (value: number | null) => value === null ? "" : Math.abs(value) < 0.005 ? "±0,00" : `${value > 0 ? "+" : "−"}${formatScore(Math.abs(value))}`;
const tone = (value: number | null) => value === null || Math.abs(value) < 0.005 ? "flat" : value > 0 ? "up" : "down";

export default async function StoreDetail({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ periode?: string }> }) {
  const [{ storeId }, query] = await Promise.all([params, searchParams]);
  const period = parsePeriod(query.periode);
  const ctx = await getContext();
  const { data: store } = await ctx.supabase.from("stores").select("*").eq("id", storeId).maybeSingle();
  if (!store || !canViewStore(ctx.memberships, store)) notFound();
  const { today, progress, drafts, history, highlights } = await loadStoreProgress(ctx.supabase, store, period);
  const operations = isOperations(ctx.memberships, store.cooperative_id);
  const download = (format: "pdf" | "pptx") => `/api/stores/${storeId}/progress?periode=${period}&format=${format}`;

  return <>
    <div className="breadcrumb"><Link href="/varehus">Varehus</Link> / {store.name}</div>
    <PageHeading eyebrow="Fremdrift" title={store.name} description="Utvikling fra måned til måned, konseptsjekker og oppgaver.">
      <StartNewMenu operations={operations} monthly={operations || ctx.memberships.some((m) => m.role === "store_manager" && m.store_id === storeId)} storeId={storeId} />
    </PageHeading>
    <div className="dashboard-toolbar">
      <nav className="segmented" aria-label="Periode">{(Object.keys(periodLabels) as Period[]).map((key) => <Link key={key} href={`/varehus/${storeId}?periode=${key}`} aria-current={key === period ? "page" : undefined}>{periodLabels[key]}</Link>)}</nav>
      <div className="page-actions store-shortcuts">
        <Link className="button" href={`/rapporter?view=active&store=${storeId}`}>Pågående ({drafts.length})</Link>
        <Link className="button" href={`/oppfolging?store=${storeId}`}>Alle oppgaver</Link>
        {/* Plain links: the browser downloads the generated file and shows its own progress. */}
        <a className="button dark" href={download("pdf")} download>Fremdriftsrapport (PDF)</a>
        <a className="button" href={download("pptx")} download>PowerPoint</a>
      </div>
    </div>

    <div className="grid-4">
      <div className="stat-card"><span className="label">Siste konseptsjekk</span><strong className="value">{progress.latestConcept ? formatScore(progress.latestConcept.total) : "—"}</strong>
        <span className="hint">{progress.latestConcept ? <><span className={`delta ${tone(progress.latestConcept.delta)}`}>{signed(progress.latestConcept.delta)}</span> {formatDate(progress.latestConcept.date)}</> : "Ingen ennå"}</span></div>
      <div className="stat-card"><span className="label">Siste driftsgjennomgang</span><strong className="value">{progress.latestMonthly ? formatScore(progress.latestMonthly.total) : "—"}</strong>
        <span className="hint">{progress.latestMonthly ? <><span className={`delta ${tone(progress.latestMonthly.delta)}`}>{signed(progress.latestMonthly.delta)}</span> {formatDate(progress.latestMonthly.date)}</> : "Ingen ennå"}</span></div>
      <div className="stat-card"><span className="label">Måneder med gjennomgang</span><strong className="value">{progress.monthsCovered} <small>av {progress.months.length}</small></strong>
        <div className="coverage" aria-label={`${progress.monthsCovered} av ${progress.months.length} måneder har driftsgjennomgang`}>{progress.series.map((month) => <i key={month.month} className={month.monthlyTotal !== null ? "on" : ""} title={month.label} />)}</div></div>
      <div className="stat-card"><span className="label">Oppgaver i perioden</span><strong className="value">{progress.tasks.done} <small>av {progress.tasks.created} utført</small></strong>
        <span className="hint">{progress.tasks.open} åpne{progress.tasks.overdue ? <> · <span className="delta down">{progress.tasks.overdue} forfalt</span></> : ""}{progress.tasks.averageDaysToDone !== null ? ` · snitt ${Math.round(progress.tasks.averageDaysToDone)} dager` : ""}</span></div>
    </div>

    <section className="panel">
      <div className="panel-header"><div><h2>Utvikling</h2><p className="muted small" style={{ margin: "5px 0 0" }}>{periodLabels[period]}. Månedlige gjennomganger er intern progresjon og teller ikke i konseptrangeringen.</p></div></div>
      {progress.series.some((month) => month.monthlyTotal !== null || month.conceptTotal !== null) ? <ProgressChart series={progress.series} /> : <p className="muted">Ingen vurderinger i perioden.</p>}
    </section>

    <div className="grid-2">
      <section className="panel">
        <div className="panel-header"><h2>Områdene</h2><span className="muted small">{progress.areaSource === "monthly" ? "Driftsgjennomganger" : "Konseptsjekker (ingen driftsgjennomganger i perioden)"}</span></div>
        <table className="area-trend-table"><thead><tr><th>Område</th><th>Utvikling</th><th>Siste</th><th>Endring</th></tr></thead><tbody>
          {progress.areaTrends.map((area) => <tr key={area.key}>
            <td>{area.label}</td>
            <td><Sparkline values={progress.series.map((month) => (progress.areaSource === "monthly" ? month.areas : month.conceptAreas)[area.key])} /></td>
            <td><strong>{formatScore(area.latest)}</strong></td>
            <td><span className={`delta ${tone(area.change)}`}>{area.change === null ? "—" : signed(area.change)}</span></td>
          </tr>)}
        </tbody></table>
      </section>
      <section className="panel">
        <div className="panel-header"><h2>Oppgaver</h2><Link className="panel-link" href={`/oppfolging?store=${storeId}`}>Se alle</Link></div>
        <TaskChart series={progress.series} />
        <div className="task-mini-list">{progress.tasks.openList.slice(0, 5).map((task) => {
          const overdue = task.dueDate && task.dueDate < today;
          return <Link className="list-card" href={`/oppfolging/${task.id}`} key={task.id}><div><h3>{task.description}</h3><p>{areas.find((area) => area.key === task.areaKey)?.label || "Generelt"} · {task.dueDate ? `Frist ${formatDate(task.dueDate)}` : "Ingen frist"}</p></div>{overdue ? <span className="status withdrawn">Forfalt</span> : <span className={`status ${task.status === "in_progress" ? "active" : ""}`}>{task.status === "in_progress" ? "Under arbeid" : "Åpen"}</span>}</Link>;
        })}{!progress.tasks.openList.length && <p className="muted small">Ingen åpne oppgaver.</p>}</div>
      </section>
    </div>

    {highlights && <section className="panel">
      <div className="panel-header"><h2>Siste styrker og forbedringer</h2><span className="muted small">{formatDate(highlights.date)}</span></div>
      <div className="grid-2 highlight-boxes">
        {highlights.strengths.length > 0 && <div className="highlight-box good"><span className="label">Styrker</span><ul>{highlights.strengths.map((line) => <li key={line}>{line}</li>)}</ul></div>}
        {highlights.improvements.length > 0 && <div className="highlight-box bad"><span className="label">Forbedringer</span><ul>{highlights.improvements.map((line) => <li key={line}>{line}</li>)}</ul></div>}
      </div>
    </section>}

    <section className="panel">
      <div className="panel-header"><h2>Alle rapporter</h2><Link className="panel-link" href={`/rapporter?view=history&store=${storeId}`}>Rapporthistorikk</Link></div>
      {history.slice(0, 12).map((report) => <Link className="list-card" href={`/rapporter/${report.id}`} key={report.id}><div><h3>{reportKindLabel(report.kind, report.eventId)}</h3><p>{formatDate(report.date)}</p></div><Score value={report.total} neutral={report.kind === "self_check"} /></Link>)}
      {!history.length && <p className="muted">Ingen publiserte rapporter.</p>}
    </section>
  </>;
}
