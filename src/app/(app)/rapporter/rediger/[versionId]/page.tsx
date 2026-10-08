import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { canOperateStore, getContext } from "@/lib/auth";
import { PageHeading } from "@/components/ui";
import Editor from "./editor";
import type { Area, Report, Version } from "@/lib/data";

export default async function EditReport({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const ctx = await getContext();
  const { data: version } = await ctx.supabase.from("report_versions").select("*").eq("id",versionId).maybeSingle();
  if (!version) notFound();
  if (version.state !== "draft") redirect(`/rapporter/${version.report_id}`);
  const { data: report } = await ctx.supabase.from("reports").select("*").eq("id",version.report_id).maybeSingle();
  if (!report) notFound();
  if (report.kind === "inspection" && !canOperateStore(ctx.memberships,report.cooperative_id,report.store_id)) notFound();
  if (report.kind === "self_check" && report.created_by !== ctx.userId) notFound();
  const [{ data: store }, { data: assessmentRows }, { data: imageRows }] = await Promise.all([
    ctx.supabase.from("stores").select("name").eq("id",report.store_id).single(),
    ctx.supabase.from("area_assessments").select("*").eq("version_id",versionId),
    ctx.supabase.from("report_images").select("*").eq("version_id",versionId).order("sort_order"),
  ]);
  const images = await Promise.all((imageRows || []).map(async (image) => {
    const { data } = await ctx.supabase.storage.from("report-images").createSignedUrl(image.object_path, 300);
    return { id:image.id, area_key:image.area_key, caption:image.caption, url:data?.signedUrl || "" };
  }));
  return <><div className="breadcrumb"><Link href="/rapporter">Rapporter</Link> / Kladd / {store?.name}</div><PageHeading eyebrow={report.kind === "inspection" ? "Uanmeldt konseptsjekk" : "Månedlig driftsgjennomgang"} title={store?.name || "Rapport"} description={version.version_no > 1 ? `Korrigering · versjon ${version.version_no}` : report.kind === "inspection" ? "Vurder de fire områdene og publiser når de er klare." : "Vurder de fire områdene. Karakterene brukes til intern progresjon, utenfor konseptrangeringen."}/><Editor version={version as Version} report={report as Report} assessments={(assessmentRows || []) as Area[]} images={images} canDelete={ctx.systemAdmin}/></>;
}
