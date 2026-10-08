import Link from "next/link";
import { Plus } from "lucide-react";
import { getContext, isOperations } from "@/lib/auth";
import { Empty, PageHeading, Status } from "@/components/ui";

function when(value: string) { return new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", dateStyle: "long", timeStyle: "short" }).format(new Date(value)); }

export default async function EventsPage() {
  const ctx = await getContext();
  const [{ data: events }, { data: stores }] = await Promise.all([
    ctx.supabase.from("events").select("id,title,description,location_store_id,starts_at,status").order("starts_at", { ascending: false }),
    ctx.supabase.from("stores").select("id,name"),
  ]);
  return <><PageHeading eyebrow="Felles aktivitet" title="Samlinger" description="Konseptrunder for inviterte varehussjefer. Resultatene holdes utenfor den offisielle konseptmålingen.">
    {isOperations(ctx.memberships) && <Link className="button primary" href="/samlinger/ny"><Plus size={16}/> Ny samling</Link>}
  </PageHeading>{events?.length ? events.map((event) => <Link className="list-card" href={`/samlinger/${event.id}`} key={event.id}>
    <div><h3>{event.title}</h3><p>{when(event.starts_at)} · {stores?.find((store) => store.id === event.location_store_id)?.name || "Varehus"}</p><p>Inviterte vurderer varehuset de besøker</p></div><Status value={event.status}/>
  </Link>) : <Empty title="Ingen samlinger ennå" description="Driftssjef kan invitere varehussjefer til en felles konseptrunde."/>}</>;
}
