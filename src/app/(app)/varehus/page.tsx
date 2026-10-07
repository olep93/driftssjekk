import Link from "next/link";
import { getContext } from "@/lib/auth";
import { latestInspections, loadCore, scoreFor } from "@/lib/data";
import { formatDate } from "@/lib/scoring";
import { Empty, PageHeading, Score } from "@/components/ui";

export default async function Stores(){
  const ctx=await getContext();const data=await loadCore(ctx.supabase);const latest=latestInspections(data.reports,data.versions);
  return <><PageHeading eyebrow="Varehus" title="Varehus" description="Historikk, utvikling og nyeste vurdering per varehus."/><section className="panel"><div className="panel-header"><h2>Varehus du har tilgang til</h2><span className="muted small">{data.stores.length} varehus</span></div>{data.stores.length?<div className="table-wrap"><table><thead><tr><th>Varehus</th><th>Siste driftssjekk</th><th>Karakter</th><th>Status</th></tr></thead><tbody>{data.stores.map((store)=>{const report=latest.find((r)=>r.store_id===store.id);const version=data.versions.find((v)=>v.id===report?.current_version_id);return <tr key={store.id}><td><Link href={`/varehus/${store.id}`}>{store.name}</Link></td><td>{formatDate(version?.visit_date)}</td><td><Score value={report?scoreFor(report,data.versions,data.areas):null}/></td><td>{store.active?"Aktivt":"Arkivert"}</td></tr>})}</tbody></table></div>:<Empty title="Ingen varehus tilgjengelige"/>}</section></>;
}
