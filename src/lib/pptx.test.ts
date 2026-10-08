import { describe,expect,it } from "vitest";
import { mkdirSync,writeFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReportPptx } from "./pptx";
import sharp from "sharp";

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
  it("lager PowerPoint for konseptrunde på samling",async()=>{
    const snapshot={kind:"event_check",store_name:"Obs Bygg Sandefjord",cooperative_name:"Coop Sørøst",round_title:"Felles samling i Sandefjord",visit_date:"2026-10-08",assessor_name:"Varehussjef",summary:"Felles vurdering",total:7,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:28,comment:"Kort observasjon.",needs_follow_up:false,images:[]}))};
    const bytes=await buildReportPptx(snapshot,{} as SupabaseClient);
    expect(bytes.byteLength).toBeGreaterThan(10000);
    expect(Buffer.from(bytes.subarray(0,4)).toString("hex")).toBe("504b0304");
  });
  it("lager PowerPoint for en delvurdering av tildelt område",async()=>{
    const snapshot={kind:"event_check",store_name:"Obs Bygg Sandefjord",cooperative_name:"Coop Sørøst",round_title:"Felles besøk",visit_date:"2026-10-08",assessor_name:"Varehussjef",summary:"Vurdering av butikk",total:7,version_no:1,areas:[{key:"store",score_quarters:28,comment:"Ryddig butikk",needs_follow_up:false,images:[]}]};
    const bytes=await buildReportPptx(snapshot,{} as SupabaseClient);
    expect(bytes.byteLength).toBeGreaterThan(10000);
    expect(Buffer.from(bytes.subarray(0,4)).toString("hex")).toBe("504b0304");
  });
  it("legger stående og liggende bilder på egne lysbilder",async()=>{
    const landscape=await sharp({create:{width:1200,height:760,channels:3,background:"#55758b"}}).jpeg().toBuffer();
    const portrait=await sharp({create:{width:760,height:1200,channels:3,background:"#b98967"}}).webp().toBuffer();
    const photos=new Map([["landscape.jpg",landscape],["portrait.webp",portrait]]);
    const storage={storage:{from:()=>({download:async(path:string)=>({data:new Blob([new Uint8Array(photos.get(path)!)],{type:path.endsWith("webp")?"image/webp":"image/jpeg"}),error:null})})}} as unknown as SupabaseClient;
    const snapshot={kind:"inspection",store_name:"Obs Bygg Tønsberg",cooperative_name:"Coop Sørøst",round_title:null,visit_date:"2026-10-08",assessor_name:"Driftssjef",summary:"Foto fra befaringen.",total:6.25,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:25,comment:"Kort observasjon.",needs_follow_up:false,images:key==="store"?[{path:"landscape.jpg",caption:"Liggende butikkbilde"},{path:"portrait.webp",caption:"Stående butikkbilde"}]:[]}))};
    const bytes=await buildReportPptx(snapshot,storage);
    expect(bytes.byteLength).toBeGreaterThan(10000);
    if(process.env.PPTX_VISUAL_QA==="1"){mkdirSync("tmp/pptx",{recursive:true});writeFileSync("tmp/pptx/qa-bildeorientering.pptx",bytes);}
  });
});
