import { describe,expect,it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReportPdf } from "./pdf";

describe("rapport-PDF",()=>{
  it("lager en flersidig A4-PDF med norske tegn og lang tekst",async()=>{
    const snapshot={kind:"inspection",store_name:"Tønsberg",cooperative_name:"Coop Sørøst",round_title:"Vår 2027",visit_date:"2027-05-15",assessor_name:"Fiktiv vurderer",summary:"ÆØÅ æøå. "+"Lang kommentar med ord og mellomrom. ".repeat(250),total:8.3125,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:33,comment:"Kommentar med norske tegn: æøå. ".repeat(50),needs_follow_up:false,images:[]}))};
    const bytes=await buildReportPdf(snapshot,{} as SupabaseClient);
    if (process.env.PDF_VISUAL_QA === "1") { mkdirSync("tmp/pdfs",{recursive:true}); writeFileSync("tmp/pdfs/qa-driftssjekk.pdf",bytes); }
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(595.28,1);
  });
  it("lager månedlig driftsgjennomgang uten konseptkarakter",async()=>{
    const snapshot={kind:"self_check",store_name:"Tønsberg",cooperative_name:"Coop Sørøst",round_title:null,visit_date:"2026-10-07",assessor_name:"Testkonto",summary:"Månedlig oppsummering",total:null,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:null,comment:"Observasjon",needs_follow_up:false,images:[]}))};
    const bytes=await buildReportPdf(snapshot,{} as SupabaseClient);
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });
  it("holder alle vurderingskriteriene på én vedleggsside i en kort rapport",async()=>{
    const snapshot={kind:"inspection",store_name:"Tønsberg",cooperative_name:"Coop Sørøst",round_title:null,visit_date:"2026-10-08",assessor_name:"Testkonto",summary:"Kort oppsummering",total:6,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:24,comment:"Kort observasjon.",needs_follow_up:false,images:[]}))};
    const pdf=await PDFDocument.load(await buildReportPdf(snapshot,{} as SupabaseClient));
    expect(pdf.getPageCount()).toBe(2);
  });
});
