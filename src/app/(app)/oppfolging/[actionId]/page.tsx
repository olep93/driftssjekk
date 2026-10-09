/* Private signed image URLs are rendered directly. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { areas, formatDate } from "@/lib/scoring";
import { PageHeading, Status } from "@/components/ui";
import TaskReplyForm from "./reply-form";

function timestamp(value: string) {
  return new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function ActionDetail({ params }: { params: Promise<{ actionId: string }> }) {
  const { actionId } = await params;
  const ctx = await getContext();
  const { data: action } = await ctx.supabase.from("actions").select("*").eq("id", actionId).maybeSingle();
  if (!action) notFound();
  const [{ data: report }, { data: updates }, { data: images }] = await Promise.all([
    ctx.supabase.from("reports").select("id,store_id,kind").eq("id", action.report_id).maybeSingle(),
    ctx.supabase.from("action_updates").select("id,actor_id,comment,new_status,created_at").eq("action_id", actionId).order("created_at"),
    ctx.supabase.from("action_images").select("id,update_id,object_path,caption,created_at").eq("action_id", actionId).order("created_at"),
  ]);
  if (!report) notFound();
  const { data: store } = await ctx.supabase.from("stores").select("name").eq("id", report.store_id).maybeSingle();
  // The action-images bucket has no user read policy. The rows above are read under RLS, so only
  // images the user may see get signed here with the service client.
  const { data: signed } = images?.length
    ? await createAdminClient().storage.from("action-images").createSignedUrls(images.map((item) => item.object_path), 300)
    : { data: [] };
  const imageUrls = (images || []).map((item) => ({ ...item, url: signed?.find((entry) => entry.path === item.object_path)?.signedUrl || "" }));
  const areaName = areas.find((item) => item.key === action.area_key)?.label || "Generelt";
  const initial = imageUrls.filter((item) => !item.update_id);
  return <><div className="breadcrumb"><Link href="/oppfolging">Oppfølging</Link> / {store?.name || "Varehus"}</div>
    <PageHeading eyebrow="Oppgave til varehus" title={store?.name || "Varehus"} description={`${report.kind === "inspection" ? "Uanmeldt konseptsjekk" : "Månedlig driftsgjennomgang"} · ${areaName}`}><Status value={action.status}/></PageHeading>
    <section className="panel task-detail"><div className="panel-header"><div><p className="eyebrow">Oppgaven</p><h2>{areaName}</h2></div><span className="muted small">Opprettet {timestamp(action.created_at)}</span></div>
      <p className="task-description">{action.description}</p>
      <p className="muted small">Frist: {formatDate(action.due_date)} · <Link href={`/rapporter/${report.id}`}>Se rapporten</Link></p>
      {initial.map((item) => <figure className="task-photo" key={item.id}>{item.url && <img src={item.url} alt={item.caption || "Bilde til oppgaven"}/>}<figcaption>{item.caption}</figcaption></figure>)}
    </section>
    <section className="panel task-thread"><div className="panel-header"><h2>Svar og fremdrift</h2><span className="muted small">{updates?.length || 0} svar</span></div>
      {(updates || []).length ? (updates || []).map((update) => <article className="task-update" key={update.id}><div className="task-update-meta"><strong>{update.actor_id === ctx.userId ? "Du" : "Oppdatering"}</strong><span>{timestamp(update.created_at)}</span><Status value={update.new_status}/></div><p>{update.comment}</p>{imageUrls.filter((item) => item.update_id === update.id).map((item) => <figure className="task-photo" key={item.id}>{item.url && <img src={item.url} alt={item.caption || "Bilde av utført arbeid"}/>}<figcaption>{item.caption}</figcaption></figure>)}</article>) : <p className="muted">Varehuset har ikke svart ennå.</p>}
    </section>
    <section className="panel"><h2>Legg inn svar</h2><p className="muted small">Beskriv hva som er gjort. Legg gjerne ved et bilde av løsningen.</p><TaskReplyForm actionId={actionId} currentStatus={action.status}/></section>
  </>;
}
