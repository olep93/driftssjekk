import Link from "next/link";
import { getContext } from "@/lib/auth";
import { latestInspections, loadCore, scoreFor } from "@/lib/data";
import { formatDate } from "@/lib/scoring";
import { Empty, PageHeading, Score } from "@/components/ui";

export default async function Stores(){
  const ctx=await getContext();const data=await loadCore(ctx.supabase);const latest=latestInspections(data.reports,data.versions);
  const visibleStores=data.stores.filter((store)=>ctx.memberships.some((membership)=>membership.cooperative_id===store.cooperative_id&&(membership.role==="cooperative_admin"||membership.store_id===store.id||(membership.role==="operations"&&membership.store_id===null))));
  return <><PageHeading eyebrow="Varehus" title="Varehus" description="Historikk, utvikling og nyeste vurdering per varehus."/><section className="panel"><div className="panel-header"><h2>Varehus du har tilgang til</h2><span className="muted small">{visibleStores.length} varehus</span></div>{visibleStores.length?<div className="table-wrap"><table><thead><tr><th>Varehus</th><th>Siste konseptsjekk</th><th>Karakter</th><th>Status</th></tr></thead><tbody>{visibleStores.map((store)=>{const report=latest.find((r)=>r.store_id===store.id);const version=data.versions.find((v)=>v.id===report?.current_version_id);return <tr key={store.id}><td><Link href={`/varehus/${store.id}`}>{store.name}</Link></td><td>{formatDate(version?.visit_date)}</td><td><Score value={report?scoreFor(report,data.versions,data.areas):null}/></td><td>{store.active?"Aktivt":"Arkivert"}</td></tr>})}</tbody></table></div>:<Empty title="Ingen varehus tilgjengelige"/>}</section></>;
}
