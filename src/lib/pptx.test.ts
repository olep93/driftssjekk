import { describe,expect,it } from "vitest";
import { mkdirSync,writeFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReportPptx, photoCells } from "./pptx";
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
  it("fordeler bilder uten å gå utenfor bildefeltet", () => {
    const area = { x: 5, y: 0.8, w: 7.6, h: 5.9 };
    for (const count of [1, 2, 3, 4, 5, 6]) {
      const cells = photoCells(count, area);
      expect(cells).toHaveLength(count);
      for (const cell of cells) {
        expect(cell.x + cell.w).toBeLessThanOrEqual(area.x + area.w + 1e-9);
        expect(cell.y + cell.h).toBeLessThanOrEqual(area.y + area.h + 1e-9);
      }
    }
  });
  it("lager ekstra bildelysbilder når et område har mange bilder", async () => {
    const jpg = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#7f97a9" } }).jpeg().toBuffer();
    const tall = await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#b19c84" } }).jpeg().toBuffer();
    const storage = { storage: { from: () => ({ download: async (path: string) => ({ data: new Blob([new Uint8Array(path.startsWith("t") ? tall : jpg)], { type: "image/jpeg" }), error: null }) }) } } as unknown as SupabaseClient;
    const images = (area: string, count: number) => Array.from({ length: count }, (_, index) => ({ path: `${index % 3 === 1 ? "t" : "w"}${area}${index}.jpg`, caption: `${area}: bilde ${index + 1}` }));
    const snapshot = { kind: "inspection", store_name: "Obs Bygg Tønsberg", cooperative_name: "Coop Sørøst", round_title: "Høstrunden 2026", visit_date: "2026-10-08", assessor_name: "Kari Nordmann", summary: "Ryddig varehus med god kampanjegjennomføring. Uteområdet trekker ned.", total: 6.4375, version_no: 1,
      areas: [{ key: "drive_in", score_quarters: 27, comment: "Ryddig og godt fylt.", needs_follow_up: false, images: images("Drive-In", 1) }, { key: "store", score_quarters: 29, comment: "Kampanjeøya er satt opp etter plan.", needs_follow_up: false, images: images("Butikk", 3) }, { key: "outdoor", score_quarters: 22, comment: "Paller og avfall ved porten mot varemottaket. ".repeat(8), needs_follow_up: true, images: images("Uteområde", 18) }, { key: "goods_receiving", score_quarters: 25, comment: "", needs_follow_up: false, images: [] }] };
    const bytes = await buildReportPptx(snapshot, storage);
    if (process.env.PPTX_VISUAL_QA === "1") { mkdirSync("tmp/pptx", { recursive: true }); writeFileSync("tmp/pptx/qa-ny-mal.pptx", bytes); }
    expect(Buffer.from(bytes.subarray(0, 4)).toString("hex")).toBe("504b0304");
  }, 30000);
});
