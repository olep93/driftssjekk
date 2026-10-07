import { redirect } from "next/navigation";
import { getContext, isOperations } from "@/lib/auth";
import { PageHeading } from "@/components/ui";
import NewRoundForm from "./round-form";

export default async function NewRound() {
  const ctx=await getContext();if(!isOperations(ctx.memberships))redirect("/oversikt");
  const [{data:stores},{data:coops}]=await Promise.all([
    ctx.supabase.from("stores").select("id,name,cooperative_id").eq("active",true).order("name"),
    ctx.supabase.from("cooperatives").select("id,name").eq("active",true),
  ]);
  return <><PageHeading eyebrow="Runder" title="Opprett runde" description="Velg hvilke varehus som skal inngå. Deltakerlisten lagres for historikken."/><section className="panel" style={{maxWidth:680}}><NewRoundForm stores={stores||[]} coops={(coops||[]).filter((c)=>isOperations(ctx.memberships,c.id))}/></section></>;
}
