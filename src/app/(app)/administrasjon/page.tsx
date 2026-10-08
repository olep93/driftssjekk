import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth";
import { PageHeading } from "@/components/ui";
import AdminControls from "./admin-controls";

export default async function Administration() {
  const ctx = await getContext();
  const adminCoops = [...new Set(ctx.memberships
    .filter((membership) => membership.role === "cooperative_admin")
    .map((membership) => membership.cooperative_id))];
  if (!adminCoops.length) redirect("/oversikt");

  const [coopsResult, storesResult, membershipsResult] = await Promise.all([
    ctx.supabase.from("cooperatives").select("id,name").in("id", adminCoops).order("name"),
    ctx.supabase.from("stores").select("id,name,cooperative_id,active")
      .in("cooperative_id", adminCoops).order("name"),
    ctx.supabase.from("memberships").select("id,user_id,cooperative_id,store_id,role")
      .in("cooperative_id", adminCoops),
  ]);

  const heading = <PageHeading eyebrow="Administrasjon" title="Tilganger og varehus"
    description="Opprett brukere og velg rolle, samvirkelag og varehus." />;
  if (coopsResult.error || storesResult.error || membershipsResult.error ||
      !coopsResult.data?.length || coopsResult.data.length !== adminCoops.length) {
    return <>{heading}<section className="panel" role="alert">
      <h2>Samvirkelagene kunne ikke hentes</h2>
      <p>Prøv å laste siden på nytt. Hvis problemet fortsetter, kontakt systemadministrator.</p>
      <a className="button" href="/administrasjon">Last siden på nytt</a>
    </section></>;
  }

  const ids = [...new Set((membershipsResult.data || []).map((membership) => membership.user_id))];
  const { data: profiles } = ids.length
    ? await ctx.supabase.from("profiles").select("id,display_name").in("id", ids)
    : { data: [] };

  return <>{heading}<AdminControls
    coops={coopsResult.data}
    stores={storesResult.data || []}
    memberships={membershipsResult.data || []}
    profiles={profiles || []}
  /></>;
}
