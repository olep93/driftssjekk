import Link from "next/link";
import { getContext } from "@/lib/auth";
import { loadCore } from "@/lib/data";
import { formatDate } from "@/lib/scoring";
import { Empty, PageHeading, Status } from "@/components/ui";
import ActionControls from "./action-controls";

export default async function FollowUp(){const ctx=await getContext();const data=await loadCore(ctx.supabase);const actions=[...data.actions].sort((a,b)=>(a.due_date||"9999").localeCompare(b.due_date||"9999"));return <><PageHeading eyebrow="Oppfølging" title="Tiltak" description="Se åpne tiltak, frister og status for varehus du har tilgang til."/><section className="panel"><div className="panel-header"><h2>{actions.filter((a)=>a.status!=="done").length} åpne tiltak</h2></div>{actions.length?<div className="table-wrap"><table><thead><tr><th>Tiltak</th><th>Varehus</th><th>Frist</th><th>Status</th><th>Oppdater</th></tr></thead><tbody>{actions.map((a)=>{const report=data.reports.find((r)=>r.id===a.report_id);const store=data.stores.find((s)=>s.id===report?.store_id);return <tr key={a.id}><td>{a.description}</td><td><Link href={`/rapporter/${a.report_id}`}>{store?.name}</Link></td><td>{formatDate(a.due_date)}</td><td><Status value={a.status}/></td><td><ActionControls id={a.id} status={a.status}/></td></tr>})}</tbody></table></div>:<Empty title="Ingen tiltak ennå" description="Opprett tiltak fra en rapport for å følge opp funn."/>}</section></>}
