import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { canOperateStore, getContext } from "@/lib/auth";
import { PageHeading } from "@/components/ui";
import Editor from "./editor";
import type { Area, Report, Version } from "@/lib/data";
import { reportKindLabel } from "@/lib/report-kind";

export default async function EditReport({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const ctx = await getContext();
  const { data: version } = await ctx.supabase.from("report_versions").select("*").eq("id",versionId).maybeSingle();
  if (!version) notFound();
  if (version.state !== "draft") redirect(`/rapporter/${version.report_id}`);
  const { data: report } = await ctx.supabase.from("reports").select("*").eq("id",version.report_id).maybeSingle();
  if (!report) notFound();
  if (report.kind === "inspection" && !canOperateStore(ctx.memberships,report.cooperative_id,report.store_id)) notFound();
  // Monthly reviews are shared between the store's managers and its operations managers.
  if (report.kind === "self_check" && !canOperateStore(ctx.memberships,report.cooperative_id,report.store_id) && !ctx.memberships.some((m) => m.role === "store_manager" && m.store_id === report.store_id)) notFound();
  if (report.event_id) {
    const { data: event } = await ctx.supabase.from("events").select("status").eq("id",report.event_id).maybeSingle();
    if (event?.status === "closed") return <><PageHeading eyebrow="Samling avsluttet" title="Vurderingen er låst" description="Driftssjef kan åpne samlingen igjen hvis vurderingen skal fullføres."/><Link className="button" href={`/samlinger/${report.event_id}`}>Tilbake til samlingen</Link></>;
  }
  const [{ data: store }, { data: assessmentRows }, { data: imageRows }] = await Promise.all([
    ctx.supabase.from("stores").select("name").eq("id",report.store_id).single(),
    ctx.supabase.from("area_assessments").select("*").eq("version_id",versionId),
    ctx.supabase.from("report_images").select("*").eq("version_id",versionId).order("sort_order"),
  ]);
  const images = await Promise.all((imageRows || []).map(async (image) => {
    const { data } = await ctx.supabase.storage.from("report-images").createSignedUrl(image.object_path, 300);
    return { id:image.id, area_key:image.area_key, caption:image.caption, path:image.object_path, url:data?.signedUrl || "" };
  }));
  return <><div className="breadcrumb"><Link href={report.event_id ? `/samlinger/${report.event_id}` : "/rapporter"}>{report.event_id ? "Samling" : "Rapporter"}</Link> / Kladd / {store?.name}</div><PageHeading eyebrow={reportKindLabel(report.kind,report.event_id)} title={store?.name || "Rapport"} description={version.version_no > 1 ? `Korrigering · versjon ${version.version_no}` : report.event_id ? "Vurder de fire konseptområdene. Resultatet holdes utenfor den offisielle rangeringen." : report.kind === "inspection" ? "Vurder de fire områdene og publiser når de er klare." : "Vurder de fire områdene. Karakterene brukes til intern progresjon, utenfor konseptrangeringen."}/><Editor version={version as Version} report={report as Report} assessments={(assessmentRows || []) as Area[]} images={images} canDelete={ctx.systemAdmin} currentUser={{id:ctx.userId,name:ctx.name}}/></>;
}
