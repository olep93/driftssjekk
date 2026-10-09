import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getContext } from "@/lib/auth";
import { loadCore } from "@/lib/data";
import { areas, formatDate } from "@/lib/scoring";
import { Empty, PageHeading, Status } from "@/components/ui";
import { focusedStoreId, selectedStoreId } from "@/lib/store-focus";

export default async function FollowUp({searchParams}: {searchParams: Promise<{store?:string}>}) {
  const params = await searchParams;
  const ctx = await getContext();
  const data = await loadCore(ctx.supabase);
  const focus = await focusedStoreId(data.stores, ctx.memberships);
  const storeId = selectedStoreId(params.store, focus, data.stores);
  const actions = data.actions.filter((action) => !storeId || data.reports.some((report) => report.id === action.report_id && report.store_id === storeId)).sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) || (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  return <><PageHeading eyebrow="Oppfølging" title="Oppgaver til varehus" description="Oppgaver fra konseptsjekker og månedlige driftsgjennomganger. Varehuset kan svare og vise bilder av løsningen."/>
    <form className="filters report-filters"><select name="store" defaultValue={params.store === "all" ? "all" : storeId || "all"} aria-label="Filtrer oppgaver på varehus"><option value="all">Alle varehus</option>{data.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select><button className="button">Vis oppgaver</button></form>
    <section className="panel"><div className="panel-header"><h2>{actions.filter((item) => item.status !== "done").length} åpne oppgaver</h2></div>
      {actions.length ? <div className="task-list">{actions.map((action) => {
        const report = data.reports.find((item) => item.id === action.report_id);
        const store = data.stores.find((item) => item.id === report?.store_id);
        const area = areas.find((item) => item.key === action.area_key)?.label || "Generelt";
        return <Link className="task-list-item" href={`/oppfolging/${action.id}`} key={action.id}><div><strong>{store?.name || "Varehus"}</strong><span>{report?.kind === "inspection" ? "Konseptsjekk" : "Månedlig driftsgjennomgang"} · {area}</span><p>{action.description}</p><small>Frist: {formatDate(action.due_date)}</small></div><div className="task-list-side"><Status value={action.status}/><ArrowUpRight size={18} aria-hidden="true"/></div></Link>;
      })}</div> : <Empty title="Ingen oppgaver ennå" description="Driftssjefen kan gi en oppgave fra et område i en publisert rapport."/>}
    </section>
  </>;
}
