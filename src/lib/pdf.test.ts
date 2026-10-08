import { describe,expect,it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReportPdf } from "./pdf";
import sharp from "sharp";

describe("rapport-PDF",()=>{
  it("lager en flersidig A4-PDF med norske tegn og lang tekst",async()=>{
    const snapshot={kind:"inspection",store_name:"Tønsberg",cooperative_name:"Coop Sørøst",round_title:"Vår 2027",visit_date:"2027-05-15",assessor_name:"Fiktiv vurderer",summary:"ÆØÅ æøå. "+"Lang kommentar med ord og mellomrom. ".repeat(250),total:8.3125,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:33,comment:"Kommentar med norske tegn: æøå. ".repeat(50),needs_follow_up:false,images:[]}))};
    const bytes=await buildReportPdf(snapshot,{} as SupabaseClient);
    if (process.env.PDF_VISUAL_QA === "1") { mkdirSync("tmp/pdfs",{recursive:true}); writeFileSync("tmp/pdfs/qa-driftssjekk.pdf",bytes); }
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(595.28,1);
  });
  it("lager månedlig driftsgjennomgang med egen driftskarakter",async()=>{
    const snapshot={kind:"self_check",store_name:"Tønsberg",cooperative_name:"Coop Sørøst",round_title:null,visit_date:"2026-10-07",assessor_name:"Testkonto",summary:"Månedlig oppsummering",total:7.5,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:30,comment:"Observasjon",needs_follow_up:false,images:[]}))};
    const bytes=await buildReportPdf(snapshot,{} as SupabaseClient);
    if (process.env.PDF_VISUAL_QA === "1") { mkdirSync("tmp/pdfs",{recursive:true}); writeFileSync("tmp/pdfs/qa-maanedlig.pdf",bytes); }
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });
  it("holder alle vurderingskriteriene på én vedleggsside i en kort rapport",async()=>{
    const snapshot={kind:"inspection",store_name:"Tønsberg",cooperative_name:"Coop Sørøst",round_title:null,visit_date:"2026-10-08",assessor_name:"Testkonto",summary:"Kort oppsummering",total:6,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:24,comment:"Kort observasjon.",needs_follow_up:false,images:[]}))};
    const pdf=await PDFDocument.load(await buildReportPdf(snapshot,{} as SupabaseClient));
    expect(pdf.getPageCount()).toBe(2);
  });
  it("plasserer stående og liggende bilder i PDF-en",async()=>{
    const landscape=await sharp({create:{width:1200,height:760,channels:3,background:"#55758b"}}).jpeg().toBuffer();
    const portrait=await sharp({create:{width:760,height:1200,channels:3,background:"#b98967"}}).webp().toBuffer();
    const photos=new Map([["landscape.jpg",landscape],["portrait.webp",portrait]]);
    const storage={storage:{from:()=>({download:async(path:string)=>({data:new Blob([new Uint8Array(photos.get(path)!)],{type:path.endsWith("webp")?"image/webp":"image/jpeg"}),error:null})})}} as unknown as SupabaseClient;
    const snapshot={kind:"self_check",store_name:"Obs Bygg Tønsberg",cooperative_name:"Coop Sørøst",round_title:null,visit_date:"2026-10-08",assessor_name:"Varehussjef",summary:"Foto fra befaringen.",total:6.25,version_no:1,areas:["drive_in","store","outdoor","goods_receiving"].map((key)=>({key,score_quarters:25,comment:"Kort observasjon.",needs_follow_up:false,images:key==="store"?[{path:"landscape.jpg",caption:"Liggande butikkbilde"},{path:"portrait.webp",caption:"Stående butikkbilde"}]:[]}))};
    const bytes=await buildReportPdf(snapshot,storage);
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    if(process.env.PDF_VISUAL_QA==="1"){mkdirSync("tmp/pdfs",{recursive:true});writeFileSync("tmp/pdfs/qa-bildeorientering.pdf",bytes);}
  });
});
