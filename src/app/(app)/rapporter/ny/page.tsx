import { redirect } from "next/navigation";
import { getContext, isOperations } from "@/lib/auth";
import { PageHeading } from "@/components/ui";
import NewReportForm from "./new-report-form";

export default async function NewReport({ searchParams }: { searchParams: Promise<{ type?: string; store?: string; round?: string }> }) {
  const params = await searchParams;
  const ctx = await getContext();
  const operations = isOperations(ctx.memberships);
  const kind = params.type === "self_check" ? "self_check" : "inspection";
  if (kind === "inspection" && !operations) redirect("/oversikt");
  const { data: stores } = await ctx.supabase.from("stores").select("id,name,cooperative_id").eq("active",true).order("name");
  const { data: rounds } = operations ? await ctx.supabase.from("rounds").select("id,title,cooperative_id,status").neq("status","closed").order("sequence_no",{ascending:false}) : { data: [] };
  const permittedStores = kind === "self_check" ? (stores || []).filter((s) => ctx.memberships.some((m) => m.role === "store_manager" && m.store_id === s.id)) : (stores || []).filter((s) => isOperations(ctx.memberships,s.cooperative_id));
  return <><PageHeading eyebrow="Rapporter" title={kind === "inspection" ? "Ny uanmeldt konseptsjekk" : "Ny månedlig driftsgjennomgang"} description="Velg varehus og start registreringen. Du kan lagre en ufullstendig kladd."/><section className="panel" style={{maxWidth:650}}><NewReportForm stores={permittedStores} rounds={rounds || []} kind={kind} initialStore={params.store} initialRound={params.round}/></section></>;
}
