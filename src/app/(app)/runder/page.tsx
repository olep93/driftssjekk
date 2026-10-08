import Link from "next/link";
import { Plus } from "lucide-react";
import { getContext, isFullOperations } from "@/lib/auth";
import { loadCore } from "@/lib/data";
import { formatDate } from "@/lib/scoring";
import { Empty, PageHeading, Status } from "@/components/ui";
import { redirect } from "next/navigation";

export default async function Rounds() {
  const ctx=await getContext();if(!isFullOperations(ctx.memberships))redirect("/oversikt");
  const data=await loadCore(ctx.supabase);
  const {data:participants}=await ctx.supabase.from("round_stores").select("round_id,store_id,exception_reason");
  return <><PageHeading eyebrow="Planlegging" title="Uanmeldte konseptsjekker" description="Samle varehusbesøk og følg fremdriften over tid."><Link className="button primary" href="/runder/ny"><Plus size={16}/> Ny konseptsjekkrunde</Link></PageHeading>{data.rounds.length?data.rounds.map((round)=>{const expected=(participants||[]).filter((p)=>p.round_id===round.id&&!p.exception_reason).length;const done=data.reports.filter((r)=>r.round_id===round.id&&r.current_version_id&&!r.withdrawn_at).length;return <Link className="list-card" href={`/runder/${round.id}`} key={round.id}><div><h3>{round.title}</h3><p>{formatDate(round.planned_from)}–{formatDate(round.planned_to)} · {done} av {expected} forventede varehus</p><div className="progress-track" style={{width:230}}><div className="progress-fill" style={{width:`${expected?Math.min(100,done/expected*100):0}%`}}/></div></div><Status value={round.status}/></Link>}):<Empty title="Ingen runder opprettet" description="Opprett en runde og velg varehus som skal vurderes." href="/runder/ny" action="Ny konseptsjekkrunde"/>}</>;
}
