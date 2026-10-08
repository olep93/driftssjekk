import { redirect } from "next/navigation";
import { canOperateStore, getContext, isOperations } from "@/lib/auth";
import { PageHeading } from "@/components/ui";
import EventForm from "./event-form";

export default async function NewEventPage() {
  const ctx = await getContext(); if (!isOperations(ctx.memberships)) redirect("/samlinger");
  const [{ data: allStores }, { data: coops }, { data: memberships }] = await Promise.all([
    ctx.supabase.from("stores").select("id,name,cooperative_id").eq("active", true).order("name"),
    ctx.supabase.from("cooperatives").select("id,name").eq("active", true),
    ctx.supabase.from("memberships").select("user_id,cooperative_id,store_id").eq("role", "store_manager"),
  ]);
  const stores = (allStores || []).filter((store) => canOperateStore(ctx.memberships, store.cooperative_id, store.id));
  const managers = (memberships || []).filter((member) => member.store_id && stores.some((store) => store.id === member.store_id));
  const ids = [...new Set(managers.map((manager) => manager.user_id))];
  const { data: profiles } = ids.length ? await ctx.supabase.from("profiles").select("id,display_name").in("id", ids) : { data: [] };
  return <><PageHeading eyebrow="Samlinger" title="Inviter til konseptrunde" description="Velg tid, samlingssted og varehussjefer. Alle får samlingen på sin side når de logger inn."/>
    <section className="panel" style={{ maxWidth: 760 }}><EventForm stores={stores} coops={(coops || []).filter((coop) => stores.some((store) => store.cooperative_id === coop.id))} managers={managers.map((manager) => ({ ...manager, store_id: manager.store_id!, name: profiles?.find((profile) => profile.id === manager.user_id)?.display_name || "Varehussjef" }))}/></section>
  </>;
}
