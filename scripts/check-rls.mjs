import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertDemoTarget } from "./demo-target.mjs";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const password=process.env.DEMO_PASSWORD;
if(!url||!publishable||!service||!password)throw new Error("Lokale Supabase- og demo-variabler mangler.");
assertDemoTarget(url);
const admin=createClient(url,service,{auth:{persistSession:false}});
async function signIn(email){const client=createClient(url,publishable,{auth:{persistSession:false}});const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;return client;}
const [ops,manager,other]=await Promise.all([
  signIn("driftssjef@demo.invalid"),signIn("varehussjef.tonsberg@demo.invalid"),signIn("driftssjef.nord@demo.invalid")
]);
const {data:coops}=await admin.from("cooperatives").select("id,name");
const southeast=coops.find((c)=>c.name==="Coop Sørøst");const north=coops.find((c)=>c.name==="Fiktivt samvirkelag Nord");
assert(southeast&&north,"Kjør demo-seed først");
const {data:stores}=await admin.from("stores").select("id,name,cooperative_id");const tonsberg=stores.find((s)=>s.name==="Tønsberg"&&s.cooperative_id===southeast.id);
assert(tonsberg);
const {data:allReports}=await admin.from("reports").select("id,cooperative_id,store_id,kind,current_version_id");
const {data:managerReports,error:managerError}=await manager.from("reports").select("id,store_id,kind,current_version_id");
assert.equal(managerError,null);assert(managerReports.length>0);assert(managerReports.every((r)=>r.store_id===tonsberg.id));
assert(managerReports.some((r)=>r.kind==="self_check"));
const {data:opsReports}=await ops.from("reports").select("id,cooperative_id");
assert(opsReports.length>0);assert(opsReports.every((r)=>r.cooperative_id===southeast.id));
const {data:otherReports}=await other.from("reports").select("id,cooperative_id");
assert(otherReports.every((r)=>r.cooperative_id===north.id));
const hiddenDraftReport=allReports.find((r)=>r.cooperative_id===southeast.id&&r.store_id!==tonsberg.id&&!r.current_version_id);
assert(hiddenDraftReport,"Demo må inneholde en skjult kladd");
const {data:hiddenVersion}=await admin.from("report_versions").select("id").eq("report_id",hiddenDraftReport.id).eq("state","draft").single();
const {data:managerVersion}=await manager.from("report_versions").select("id").eq("id",hiddenVersion.id).maybeSingle();assert.equal(managerVersion,null);
const deniedWrite=await manager.from("reports").insert({cooperative_id:southeast.id,store_id:tonsberg.id,kind:"inspection",created_by:randomUUID()});
assert(deniedWrite.error,"Direkte tabellskriving må være sperret");
const objectPath=`${hiddenVersion.id}/${randomUUID()}.png`;
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlMtF8AAAAASUVORK5CYII=","base64");
const upload=await ops.storage.from("report-images").upload(objectPath,png,{contentType:"image/png"});assert.equal(upload.error,null);
try{
  const deniedRead=await manager.storage.from("report-images").createSignedUrl(objectPath,60);
  assert(deniedRead.error,"Varehussjef fikk signert lenke til skjult kladd");
  const deniedUpload=await manager.storage.from("report-images").upload(`${hiddenVersion.id}/${randomUUID()}.png`,png,{contentType:"image/png"});
  assert(deniedUpload.error,"Varehussjef fikk laste opp i driftssjefens kladd");
}finally{await ops.storage.from("report-images").remove([objectPath]);}
const {data:managerMembership}=await admin.from("memberships").select("*").eq("store_id",tonsberg.id).eq("role","store_manager").single();
const {error:removeError}=await admin.from("memberships").delete().eq("id",managerMembership.id);assert.equal(removeError,null);
try{
  const {data:afterRevocation}=await manager.from("reports").select("id");
  assert.equal(afterRevocation.length,0,"Tilgangen må forsvinne selv med eksisterende session");
}finally{
  const membership={...managerMembership};delete membership.id;
  const {error:restoreError}=await admin.from("memberships").insert(membership);
  assert.equal(restoreError,null,"Kunne ikke gjenopprette demotildeling");
}
console.log("RLS: rollegrenser, skjult kladd, direkte skriving, Storage og rolletilbaketrekking bestått.");
