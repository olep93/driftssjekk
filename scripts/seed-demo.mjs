import { createClient } from "@supabase/supabase-js";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const password=process.env.DEMO_PASSWORD;
if(!url||!key||!password)throw new Error("Sett NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY og DEMO_PASSWORD.");
if(!["localhost","127.0.0.1"].includes(new URL(url).hostname))throw new Error("Demodata kan bare legges inn i lokal Supabase.");
if(password.length<12)throw new Error("DEMO_PASSWORD må ha minst 12 tegn.");
const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
async function insert(table,value){const {data,error}=await db.from(table).insert(value).select().single();if(error)throw new Error(`${table}: ${error.message}`);return data;}
async function user(email,name){const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name}});if(error||!data.user)throw new Error(error?.message||"Kunne ikke opprette demobruker");await insert("profiles",{id:data.user.id,display_name:name});return data.user.id;}
const existing=await db.from("cooperatives").select("id").eq("name","Coop Sørøst").maybeSingle();
if(existing.data)throw new Error("Demodata finnes allerede. Bruk en ny lokal database for å kjøre seed på nytt.");
const southeast=await insert("cooperatives",{name:"Coop Sørøst"});
const other=await insert("cooperatives",{name:"Fiktivt samvirkelag Nord"});
const names=["Tønsberg","Mjøndalen","Skien","Sandefjord","Kongsberg"];
const stores={};for(const name of names)stores[name]=await insert("stores",{cooperative_id:southeast.id,name});
await insert("stores",{cooperative_id:southeast.id,name:"Arkivert demovarehus",active:false});
await insert("stores",{cooperative_id:other.id,name:"Fiktivt Nord varehus"});
const ops=await user("driftssjef@demo.invalid","Fiktiv Driftssjef");
const manager=await user("varehussjef.tonsberg@demo.invalid","Fiktiv Varehussjef");
const otherOps=await user("driftssjef.nord@demo.invalid","Fiktiv Nord Driftssjef");
await insert("memberships",{user_id:ops,cooperative_id:southeast.id,store_id:null,role:"operations"});
await insert("memberships",{user_id:ops,cooperative_id:southeast.id,store_id:null,role:"cooperative_admin"});
await insert("memberships",{user_id:manager,cooperative_id:southeast.id,store_id:stores.Tønsberg.id,role:"store_manager"});
await insert("memberships",{user_id:otherOps,cooperative_id:other.id,store_id:null,role:"operations"});
await insert("memberships",{user_id:otherOps,cooperative_id:other.id,store_id:null,role:"cooperative_admin"});
const rounds=[];
for(const [index,title,from,to,status] of [
  [1,"Driftsrunde 1 – høst 2026","2026-09-01","2026-10-31","closed"],
  [2,"Driftsrunde 2 – vinter 2027","2027-01-01","2027-03-31","closed"],
  [3,"Driftsrunde 3 – vår 2027","2027-04-01","2027-06-30","active"],
]){
  const round=await insert("rounds",{cooperative_id:southeast.id,title,sequence_no:index,planned_from:from,planned_to:to,status,created_by:ops,summary:index===1?"Fiktive demodata: fokus på orden og flyt i varehuset.":""});
  rounds.push(round);
  for(const name of names)await insert("round_stores",{round_id:round.id,cooperative_id:southeast.id,store_id:stores[name].id,exception_reason:index===1&&name==="Kongsberg"?"Fiktivt unntak for demo av manglende sammenligning":null});
}
const areaKeys=["drive_in","store","outdoor","goods_receiving"];
async function version(report,number,date,scores,summary,published=true,reason=null){
  const v=await insert("report_versions",{report_id:report.id,version_no:number,state:published?"published":"draft",visit_date:date,summary,assessor_id:report.kind==="self_check"?manager:ops,published_at:published?`${date}T12:00:00Z`:null,published_by:published?(report.kind==="self_check"?manager:ops):null,change_reason:reason});
  for(let i=0;i<4;i++)await insert("area_assessments",{version_id:v.id,area_key:areaKeys[i],score_quarters:scores?.[i]??null,comment:`Fiktiv observasjon for ${areaKeys[i]}.`,needs_follow_up:i===3&&number===1});
  if(published){
    const storeName=Object.keys(stores).find((name)=>stores[name].id===report.store_id)||"Fiktivt varehus";
    const round=rounds.find((r)=>r.id===report.round_id);
    const snapshot={schema_version:1,calculation:"equal_weight_quarters_v1",report_id:report.id,version_id:v.id,version_no:number,kind:report.kind,cooperative_name:"Coop Sørøst",store_name:storeName,round_title:round?.title||null,visit_date:date,assessor_name:report.kind==="self_check"?"Fiktiv Varehussjef":"Fiktiv Driftssjef",summary,total:scores.reduce((a,b)=>a+b,0)/16,areas:areaKeys.map((key,i)=>({key,score_quarters:scores[i],comment:`Fiktiv observasjon for ${key}.`,needs_follow_up:i===3&&number===1,images:[]}))};
    await insert("publication_snapshots",{version_id:v.id,content:snapshot,total_quarters_sum:scores.reduce((a,b)=>a+b,0)});
    await insert("exports",{version_id:v.id,requested_by:report.kind==="self_check"?manager:ops,kind:"report_pdf"});
    const {error}=await db.from("reports").update({current_version_id:v.id}).eq("id",report.id);if(error)throw error;
  }
  return v;
}
const scores=[
  [[32,31,29,28],[30,29,31,27],[27,30,28,26],[31,32,29,30]],
  [[33,34,35,31],[32,31,32,30],[29,31,30,28],[33,33,31,31],[28,29,27,26]],
  [[35,34,35,32],[33,32,32,31]],
];
for(let ri=0;ri<3;ri++){
  const included=ri===0?names.slice(0,4):ri===1?names:names.slice(0,2);
  for(let si=0;si<included.length;si++){
    const name=included[si];const report=await insert("reports",{cooperative_id:southeast.id,store_id:stores[name].id,round_id:rounds[ri].id,kind:"inspection",created_by:ops});
    await version(report,1,["2026-09-15","2027-02-15","2027-05-15"][ri],scores[ri][si],"Fiktiv rapport for demonstrasjon.");
    if(ri===1&&si===0)await version(report,2,"2027-02-15",[34,34,35,31],"Fiktiv korrigert vurdering.",true,"Fiktiv korrigering av Drive-In-karakter.");
  }
}
const draft=await insert("reports",{cooperative_id:southeast.id,store_id:stores.Skien.id,round_id:rounds[2].id,kind:"inspection",created_by:ops});
await version(draft,1,"2027-05-20",[32,null,null,null],"Ufullstendig fiktiv kladd.",false);
const self=await insert("reports",{cooperative_id:southeast.id,store_id:stores.Tønsberg.id,round_id:null,kind:"self_check",created_by:manager});
await version(self,1,"2027-05-22",[36,35,33,32],"Fiktiv egenkontroll.");
await insert("rounds",{cooperative_id:other.id,title:"Fiktiv nordrunde",sequence_no:1,status:"planned",created_by:otherOps});
console.log("Fiktive demodata er opprettet i lokal Supabase. Kontoer bruker e-postadresser under demo.invalid.");
