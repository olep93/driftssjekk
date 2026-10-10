import { redirect } from "next/navigation";
import { canOperateStore, getContext, isOperations } from "@/lib/auth";
import { PageHeading } from "@/components/ui";
import NewReportForm from "./new-report-form";
import { focusedStoreId } from "@/lib/store-focus";

export default async function NewReport({ searchParams }: { searchParams: Promise<{ type?: string; store?: string; round?: string }> }) {
  const params = await searchParams;
  const ctx = await getContext();
  const operations = isOperations(ctx.memberships);
  const kind = params.type === "self_check" ? "self_check" : "inspection";
  if (kind === "inspection" && !operations) redirect("/oversikt");
  const { data: stores } = await ctx.supabase.from("stores").select("id,name,cooperative_id").eq("active",true).order("name");
  const { data: coops } = await ctx.supabase.from("cooperatives").select("id,name").order("name");
  const { data: rounds } = operations ? await ctx.supabase.from("rounds").select("id,title,cooperative_id,status").neq("status","closed").order("sequence_no",{ascending:false}) : { data: [] };
  // Monthly reviews: the store's own managers and operations managers with access to the store.
  const permittedStores = (stores || []).filter((s) => canOperateStore(ctx.memberships,s.cooperative_id,s.id) || (kind === "self_check" && ctx.memberships.some((m) => m.role === "store_manager" && m.store_id === s.id)));
  const homeStore = ctx.memberships.find((membership) => membership.role === "store_manager")?.store_id;
  const focus = operations ? await focusedStoreId((stores || []).map((store) => ({ ...store, active: true })), ctx.memberships) : null;
  const { data: inspectionReports } = permittedStores.length
    ? await ctx.supabase.from("reports").select("id,store_id,round_id").eq("kind",kind).is("event_id",null).is("archived_at",null).is("withdrawn_at",null).in("store_id",permittedStores.map((store) => store.id)).order("created_at",{ascending:false}).limit(200)
    : { data: [] };
  const { data: openVersions } = inspectionReports?.length
    ? await ctx.supabase.from("report_versions").select("id,report_id,updated_at").eq("state","draft").in("report_id",inspectionReports.map((report) => report.id))
    : { data: [] };
  const sharedDrafts = (openVersions || []).flatMap((version) => {
    const report = inspectionReports?.find((entry) => entry.id === version.report_id);
    return report ? [{versionId:version.id,storeId:report.store_id,roundId:report.round_id,updatedAt:version.updated_at}] : [];
  }).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  return <><PageHeading eyebrow="Rapporter" title={kind === "inspection" ? "Ny uanmeldt konseptsjekk" : "Ny månedlig driftsgjennomgang"} description={kind === "inspection" ? "Driftssjefer med tilgang til samme varehus kan fortsette i den samme kladden." : "Varehussjef og driftssjef kan fylle ut den samme kladden, også samtidig."}/><section className="panel" style={{maxWidth:650}}><NewReportForm stores={permittedStores} coops={coops || []} rounds={rounds || []} sharedDrafts={sharedDrafts} kind={kind} initialStore={permittedStores.some((store) => store.id === params.store) ? params.store : focus || homeStore || undefined} initialRound={params.round}/></section></>;
}
