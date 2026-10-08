import { describe,expect,it } from "vitest";
import { mkdirSync,writeFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReportPptx } from "./pptx";

describe("rapport-PowerPoint",()=>{
  it("lager en åpnebar presentasjon med sammendrag, områder og kriterier",async()=>{
    const snapshot={kind:"inspection",store_name:"Tønsberg",cooperative_name:"Coop Sørøst",round_title:"Vår 2027",visit_date:"2027-05-15",assessor_name:"Fiktiv vurderer",summary:"En kort oppsummering fra testvarehuset.",total:6,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:24,comment:"Ryddig og god orden.",needs_follow_up:false,images:[]}))};
    const bytes=await buildReportPptx(snapshot,{} as SupabaseClient);
    expect(bytes.byteLength).toBeGreaterThan(10000);
    expect(Buffer.from(bytes.subarray(0,4)).toString("hex")).toBe("504b0304");
    if(process.env.PPTX_VISUAL_QA==="1"){mkdirSync("tmp/pptx",{recursive:true});writeFileSync("tmp/pptx/qa-driftssjekk.pptx",bytes);}
  });
  it("lager månedlig presentasjon med driftskarakter",async()=>{
    const snapshot={kind:"self_check",store_name:"Tønsberg",cooperative_name:"Coop Sørøst",round_title:null,visit_date:"2026-10-07",assessor_name:"Testkonto",summary:"Månedlig progresjon.",total:7.5,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:30,comment:"Observasjon",needs_follow_up:false,images:[]}))};
    const bytes=await buildReportPptx(snapshot,{} as SupabaseClient);
    expect(Buffer.from(bytes.subarray(0,4)).toString("hex")).toBe("504b0304");
    if(process.env.PPTX_VISUAL_QA==="1"){mkdirSync("tmp/pptx",{recursive:true});writeFileSync("tmp/pptx/qa-maanedlig.pptx",bytes);}
  });
});
