import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReportPdf, reportPdfPath } from "@/lib/pdf";

export const runtime="nodejs";
export const maxDuration=60;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Ingen tilgang"},{status:401});
  const admin=createAdminClient();
  const {data:exports,error:exportError}=await admin.rpc("claim_export_jobs");
  if(exportError)return NextResponse.json({error:exportError.message},{status:500});
  const results:{pdf:number;email:number;errors:string[]}={pdf:0,email:0,errors:[]};
  for(const job of exports||[]){
    try{
      if(!job.version_id)throw new Error("PDF mangler versjon");
      const {data:row,error}=await admin.from("publication_snapshots").select("content").eq("version_id",job.version_id).single();
      if(error||!row)throw new Error("Publiseringsgrunnlag mangler");
      const pdf=await buildReportPdf(row.content,admin);
      const path=reportPdfPath(job.version_id);
      const {error:uploadError}=await admin.storage.from("report-exports").upload(path,Buffer.from(pdf),{contentType:"application/pdf",upsert:false});
      if(uploadError && !/already exists|duplicate/i.test(uploadError.message))throw uploadError;
      await admin.from("exports").update({status:"ready",object_path:path,error:null,updated_at:new Date().toISOString()}).eq("id",job.id);
      results.pdf++;
    }catch(e){const message=e instanceof Error?e.message:"PDF-jobb feilet";results.errors.push(message);await admin.from("exports").update({status:"failed",error:message,updated_at:new Date().toISOString()}).eq("id",job.id);}
  }
  const {data:notifications,error:notificationError}=await admin.rpc("claim_notification_jobs");
  if(notificationError)results.errors.push(notificationError.message);
  for(const job of notifications||[]){
    try{
      const {data:version}=await admin.from("report_versions").select("report_id").eq("id",job.version_id).single();
      const {data:report}=await admin.from("reports").select("store_id,withdrawn_at").eq("id",version?.report_id).single();
      if(report?.withdrawn_at){await admin.from("notification_outbox").update({status:"cancelled",error:"Rapport trukket tilbake",updated_at:new Date().toISOString()}).eq("id",job.id);continue;}
      const {data:membership}=await admin.from("memberships").select("id").eq("user_id",job.recipient_id).eq("store_id",report?.store_id).eq("role","store_manager").maybeSingle();
      if(!membership){await admin.from("notification_outbox").update({status:"cancelled",error:"Tilgang opphevet",updated_at:new Date().toISOString()}).eq("id",job.id);continue;}
      if(!process.env.RESEND_API_KEY||!process.env.NOTIFICATION_FROM)throw new Error("E-post er ikke konfigurert");
      const {data:snapshot}=await admin.from("publication_snapshots").select("content").eq("version_id",job.version_id).single();
      const content=snapshot?.content as {store_name?:string;round_title?:string}|null;
      const storeName=content?.store_name||"varehuset";
      const subject=`Ny driftssjekk for ${storeName}`;
      const site=process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin;
      const body=`En ny driftssjekk for ${storeName}${content?.round_title?` i ${content.round_title}`:""} er publisert. Logg inn for å lese rapporten: ${site}/rapporter/${version?.report_id}`;
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":job.idempotency_key},body:JSON.stringify({from:process.env.NOTIFICATION_FROM,to:[job.recipient_email],subject,text:body})});
      if(!response.ok)throw new Error(`E-postleverandør svarte ${response.status}`);
      await admin.from("notification_outbox").update({status:"sent",error:null,updated_at:new Date().toISOString()}).eq("id",job.id);
      results.email++;
    }catch(e){const message=e instanceof Error?e.message:"E-postjobb feilet";results.errors.push(message);await admin.from("notification_outbox").update({status:"failed",error:message,updated_at:new Date().toISOString()}).eq("id",job.id);}
  }
  return NextResponse.json(results);
}
