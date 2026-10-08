import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import { areas, averageFromQuarters } from "@/lib/scoring";
import { PageHeading, Score, Status } from "@/components/ui";
import { summarizeEvent, type EventSourceSnapshot } from "@/lib/event-summary";
import EventControls from "./event-controls";
import DeleteEvent from "./delete-event";

function when(value: string | null) { return value ? new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", dateStyle: "long", timeStyle: "short" }).format(new Date(value)) : ""; }

export default async function EventDetail({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params; const ctx = await getContext();
  const { data: event } = await ctx.supabase.from("events").select("*").eq("id", eventId).maybeSingle(); if (!event) notFound();
  const { data: canManage } = await ctx.supabase.rpc("can_manage_event", { p_event: eventId });
  const [{ data: participants }, { data: reports }, { data: stores }] = await Promise.all([
    ctx.supabase.from("event_participants").select("user_id,home_store_id,target_store_id,area_keys").eq("event_id", eventId),
    ctx.supabase.from("reports").select("id,created_by,current_version_id,store_id,withdrawn_at").eq("event_id", eventId),
    ctx.supabase.from("stores").select("id,name"),
  ]);
  const reportIds = (reports || []).map((report) => report.id);
  const versionIds = (reports || []).map((report) => report.current_version_id).filter((id): id is string => Boolean(id));
  const [{ data: versions }, { data: assessments }, { data: profiles }, { data: snapshots }] = await Promise.all([
    reportIds.length ? ctx.supabase.from("report_versions").select("id,report_id,state,version_no").in("report_id", reportIds) : Promise.resolve({ data: [] }),
    versionIds.length ? ctx.supabase.from("area_assessments").select("version_id,score_quarters").in("version_id", versionIds) : Promise.resolve({ data: [] }),
    canManage && participants?.length ? ctx.supabase.from("profiles").select("id,display_name").in("id", participants.map((item) => item.user_id)) : Promise.resolve({ data: [] }),
    canManage && versionIds.length ? ctx.supabase.from("publication_snapshots").select("version_id,content").in("version_id", versionIds) : Promise.resolve({ data: [] }),
  ]);
  const score = (versionId: string | null, assigned: string[]) => {
    const rows = (assessments || []).filter((item) => item.version_id === versionId);
    return rows.length === assigned.length && rows.every((item) => item.score_quarters !== null)
      ? averageFromQuarters(rows.map((item) => item.score_quarters!)) : null;
  };
  const areaNames = (keys: string[]) => areas.filter((area) => keys.includes(area.key)).map((area) => area.label).join(", ");
  const myParticipant = participants?.find((item) => item.user_id === ctx.userId);
  const myReport = reports?.find((item) => item.created_by === ctx.userId);
  const completed = (reports || []).filter((report) => report.current_version_id && !report.withdrawn_at).length;
  const combined = canManage ? summarizeEvent((reports || []).filter((report) => report.current_version_id && !report.withdrawn_at).flatMap((report) => {
    const source = snapshots?.find((snapshot) => snapshot.version_id === report.current_version_id)?.content as EventSourceSnapshot | undefined;
    return source ? [{ name: profiles?.find((profile) => profile.id === report.created_by)?.display_name || "Deltaker", snapshot: source }] : [];
  })) : null;
  const readyToExport = Boolean(canManage && participants?.length && completed === participants.length && combined?.covered === 4);
  const host = stores?.find((store) => store.id === event.location_store_id)?.name || "Varehus";
  return <><div className="breadcrumb"><Link href="/samlinger">Samlinger</Link> / {event.title}</div>
    <PageHeading eyebrow="Konseptrunde på samling" title={event.title} description={`${when(event.starts_at)} · ${host}`}><Status value={event.status}/></PageHeading>
    <div className="grid-2"><section className="panel" style={{ marginTop: 0 }}><h2>Om samlingen</h2><p>{event.description || "Felles konseptvurdering for inviterte varehussjefer."}</p><p className="muted small"><strong>Varehus:</strong> {host}<br/><strong>Fra:</strong> {when(event.starts_at)}{event.ends_at && <><br/><strong>Til:</strong> {when(event.ends_at)}</>}<br/><strong>Vurdering:</strong> Alle vurderer {host}</p></section>
      <section className="panel" style={{ marginTop: 0 }}><h2>Din konseptrunde</h2>{myParticipant ? <><p>Du skal vurdere <strong>{host}</strong>: {areaNames(myParticipant.area_keys)}. Karakterer, kommentarer og bilder lagres i rapporten.</p><EventControls eventId={eventId} status={event.status} canManage={false} canStart={!myReport} />{myReport && (myReport.current_version_id || event.status === "planned" ? <Link className="button primary" href={myReport.current_version_id ? `/rapporter/${myReport.id}` : `/rapporter/rediger/${versions?.find((version) => version.report_id === myReport.id && version.state === "draft")?.id}`}>{myReport.current_version_id ? "Se din rapport" : "Fortsett vurderingen"}</Link> : <p className="muted">Samlingen er avsluttet. Kladden kan fortsettes hvis driftssjef åpner samlingen igjen.</p>)}</> : <p className="muted">Du er ikke invitert som deltaker til denne samlingen.</p>}<p className="muted small" style={{ marginTop: 15 }}>Samlingens karakterer påvirker verken kåringen av årets varehus eller månedlig progresjon.</p></section></div>
    {canManage && <section className="panel"><div className="panel-header"><div><h2>Deltakere og fremdrift</h2><p className="muted small" style={{ margin: "5px 0 0" }}>{completed} av {participants?.length || 0} ferdige vurderinger · {combined?.covered || 0} av 4 områder dekket</p></div><EventControls eventId={eventId} status={event.status} canManage /></div>
      <div className="grid-4" style={{ margin: "16px 0" }}>{areas.map((area) => <div className="stat-card" key={area.key}><span className="label">{area.label}</span><strong className="value"><Score value={combined?.areas.find((item) => item.key === area.key)?.score_quarters == null ? null : combined.areas.find((item) => item.key === area.key)!.score_quarters! / 4} neutral/></strong></div>)}</div>
      {readyToExport ? <div className="page-actions" style={{ marginBottom: 18 }}><span className="muted small">Samlet karakter: <strong>{combined?.total?.toFixed(2).replace(".", ",")}</strong></span><a className="button" href={`/api/events/${eventId}/export?format=pdf`}>Last ned samlet PDF</a><a className="button" href={`/api/events/${eventId}/export?format=pptx`}>Last ned samlet PowerPoint</a></div> : <p className="muted small">Samlet rapport kan lastes ned når alle deltakere har publisert sine tildelte områder.</p>}
      <div className="table-wrap"><table><thead><tr><th>Varehussjef</th><th>Tilhører</th><th>Tildelte områder</th><th>Status</th><th>Karakter</th><th></th></tr></thead><tbody>{participants?.map((participant) => {
        const report = reports?.find((item) => item.created_by === participant.user_id);
        const draft = versions?.find((version) => version.report_id === report?.id && version.state === "draft");
        return <tr key={participant.user_id}><td>{profiles?.find((profile) => profile.id === participant.user_id)?.display_name || "Varehussjef"}</td><td>{stores?.find((store) => store.id === participant.home_store_id)?.name || "—"}</td><td>{areaNames(participant.area_keys)}</td><td><Status value={report?.current_version_id ? "published" : draft ? "draft" : "planned"}/></td><td><Score value={score(report?.current_version_id || null,participant.area_keys)} neutral/></td><td>{report?.current_version_id && <Link className="panel-link" href={`/rapporter/${report.id}`}>Se rapport</Link>}</td></tr>;
      })}</tbody></table></div></section>}
    {ctx.systemAdmin && <DeleteEvent eventId={eventId}/>}
  </>;
}
