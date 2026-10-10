import Link from "next/link";
import { getContext, isFullOperations, isOperations } from "@/lib/auth";
import { loadCore, scoreFor } from "@/lib/data";
import { formatDate } from "@/lib/scoring";
import { Empty, PageHeading, Score, Status } from "@/components/ui";
import { StartNewMenu } from "@/components/app-navigation";
import { reportKindLabel } from "@/lib/report-kind";
import { focusedStoreId, selectedStoreId } from "@/lib/store-focus";

type Filters = { store?: string; kind?: string; year?: string; page?: string; view?: string };

export default async function Reports({ searchParams }: { searchParams: Promise<Filters> }) {
  const params = await searchParams;
  const ctx = await getContext();
  const data = await loadCore(ctx.supabase);
  const focus = await focusedStoreId(data.stores, ctx.memberships);
  const storeId = selectedStoreId(params.store, focus, data.stores);
  const storeFilter = params.store === "all" ? "all" : storeId || "all";
  const visibleReports = data.reports.filter((report) => !report.archived_at && (!storeId || report.store_id === storeId) && (!params.kind || (params.kind === "event_check" ? Boolean(report.event_id) : report.kind === params.kind && !report.event_id)));
  const drafts = visibleReports.flatMap((report) => data.versions.filter((version) => version.report_id === report.id && version.state === "draft").map((version) => ({ report, version })))
    .filter(({ report, version }) => !report.withdrawn_at && (!params.year || (version.visit_date || report.created_at).startsWith(params.year!)));
  const published = visibleReports.filter((report) => report.current_version_id && (!params.year || data.versions.find((version) => version.id === report.current_version_id)?.visit_date?.startsWith(params.year)));
  const view = params.view === "history" ? "history" : params.view === "active" ? "active" : drafts.length ? "active" : "history";
  const count = view === "active" ? drafts.length : published.length;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 20;
  const pagedDrafts = drafts.slice((page - 1) * pageSize, page * pageSize);
  const pagedPublished = published.slice((page - 1) * pageSize, page * pageSize);
  const eventIds = [...new Set(published.map((report) => report.event_id).filter((id): id is string => Boolean(id)))];
  const { data: events } = eventIds.length ? await ctx.supabase.from("events").select("id,title").in("id", eventIds) : { data: [] };
  const href = (next: Partial<Filters>) => {
    const query = new URLSearchParams({ view, store: storeFilter, ...(params.kind ? { kind: params.kind } : {}), ...(params.year ? { year: params.year } : {}), ...next });
    return `/rapporter?${query}`;
  };
  return <>
    <PageHeading eyebrow="Rapporter" title="Rapporter" description="Pågående arbeid og publiserte vurderinger samlet på ett sted.">
      <Link className="button" href="/rapporter/utvikling">Konseptutvikling</Link>
      <Link className="button" href="/rapporter/utvikling?kind=self_check">Månedlig progresjon</Link>
      <StartNewMenu operations={isOperations(ctx.memberships)} fullOperations={isFullOperations(ctx.memberships)} monthly={isOperations(ctx.memberships) || ctx.memberships.some((member) => member.role === "store_manager")} storeId={storeId || undefined}/>
    </PageHeading>
    <nav className="report-tabs" aria-label="Rapportvisning">
      <Link href={href({ view: "active", page: "1" })} aria-current={view === "active" ? "page" : undefined}>Pågående <span>{drafts.length}</span></Link>
      <Link href={href({ view: "history", page: "1" })} aria-current={view === "history" ? "page" : undefined}>Historikk <span>{published.length}</span></Link>
    </nav>
    <form className="filters report-filters"><input type="hidden" name="view" value={view}/><select name="store" defaultValue={storeFilter} aria-label="Filtrer varehus"><option value="all">Alle varehus</option>{data.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select><select name="kind" defaultValue={params.kind || ""} aria-label="Filtrer rapporttype"><option value="">Alle typer</option><option value="inspection">Uanmeldt konseptsjekk</option><option value="self_check">Månedlig driftsgjennomgang</option><option value="event_check">Konseptrunde på samling</option></select><input name="year" type="number" min="2000" max="2100" placeholder="År" defaultValue={params.year || ""} aria-label="År"/><button className="button">Filtrer</button></form>
    {view === "active" ? <section className="panel"><div className="panel-header"><div><h2>Pågående rapporter</h2><p className="muted small">Kladder og korrigeringer som kan fortsettes.</p></div><span className="muted small">{drafts.length} kladder</span></div>{pagedDrafts.length ? pagedDrafts.map(({ report, version }) => <Link className="list-card" href={`/rapporter/rediger/${version.id}`} key={version.id}><div><h3>{data.stores.find((store) => store.id === report.store_id)?.name || "Varehus"}</h3><p>{reportKindLabel(report.kind, report.event_id)} · {formatDate(version.visit_date || report.created_at)}{report.current_version_id ? " · Korrigering" : ""}</p></div><span className="panel-link">Fortsett kladd →</span></Link>) : <Empty title="Ingen pågående rapporter" description="Start en ny sjekk fra menyen, eller velg Historikk for å se publiserte rapporter."/ >}</section> : <section className="panel"><div className="panel-header"><div><h2>Publiserte rapporter</h2><p className="muted small">Tidligere konseptsjekker og driftsgjennomganger.</p></div><span className="muted small">{published.length} rapporter</span></div>{pagedPublished.length ? <div className="table-wrap"><table><thead><tr><th>Varehus</th><th>Type</th><th>Dato</th><th>Runde</th><th>Status</th><th>Karakter</th><th></th></tr></thead><tbody>{pagedPublished.map((report) => { const version = data.versions.find((entry) => entry.id === report.current_version_id); return <tr key={report.id}><td><Link href={`/rapporter/${report.id}`}>{data.stores.find((store) => store.id === report.store_id)?.name}</Link></td><td>{reportKindLabel(report.kind, report.event_id)}</td><td>{formatDate(version?.visit_date)}</td><td>{report.event_id ? events?.find((event) => event.id === report.event_id)?.title || "Samling" : data.rounds.find((round) => round.id === report.round_id)?.title || "Enkeltbesøk"}</td><td><Status value={report.withdrawn_at ? "withdrawn" : "published"}/></td><td><Score value={scoreFor(report, data.versions, data.areas)} neutral={report.kind === "self_check"}/></td><td><Link className="panel-link" href={`/rapporter/${report.id}`}>Åpne</Link></td></tr>; })}</tbody></table></div> : <Empty title="Ingen publiserte rapporter funnet" description="Juster filtrene eller gå til Pågående."/ >}</section>}
    {count > pageSize && <div className="page-actions report-pagination">{page > 1 && <Link className="button" href={href({ page: String(page - 1) })}>Forrige</Link>}<span className="muted small">Side {page}</span>{count > page * pageSize && <Link className="button" href={href({ page: String(page + 1) })}>Neste</Link>}</div>}
  </>;
}
