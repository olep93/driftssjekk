import PptxGenJS from "pptxgenjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { areas, formatDate, formatScore } from "./scoring";
import { conceptBand, conceptLabel, criteriaSections } from "./criteria";

type Snapshot = { kind:string;store_name:string;cooperative_name:string;round_title:string|null;visit_date:string;assessor_name:string;summary:string;total:number|null;version_no:number;areas:{key:string;score_quarters:number|null;comment:string;needs_follow_up:boolean;images:{path:string;caption:string}[]}[] };
const navy="142B43", orange="D66B28", green="236A4F", red="AD4944", muted="68788A", line="DCE4EB";
const width=13.333;
export const reportPptxTemplateVersion="criteria-20261007";
export function reportPptxPath(versionId:string){return `reports/${versionId}-${reportPptxTemplateVersion}.pptx`;}
function bandColor(score:number|null){return conceptBand(score)==="below"?red:conceptBand(score)==="above"?green:navy;}
function clean(value:string){return value.replace(/[\u0000-\u001f]/g," ").trim();}
function pieces(value:string,max=320){const words=clean(value).split(/\s+/);const result:string[]=[];let current="";for(const word of words){if(current&&`${current} ${word}`.length>max){result.push(current);current=word;}else current=current?`${current} ${word}`:word;}if(current)result.push(current);return result.length?result:["Ingen kommentar."];}
export async function buildReportPptx(snapshot:Snapshot,supabase:SupabaseClient):Promise<Uint8Array>{
  const pptx=new PptxGenJS();pptx.layout="LAYOUT_WIDE";pptx.author="Driftssjekk";pptx.subject="Rapport fra varehus";pptx.title=`${snapshot.store_name} – ${snapshot.kind==="inspection"?"konseptsjekk":"driftsgjennomgang"}`;
  pptx.theme={headFontFace:"Arial",bodyFontFace:"Arial"};
  const kind=snapshot.kind==="inspection"?"Uanmeldt konseptsjekk":"Månedlig driftsgjennomgang";
  const slides:PptxGenJS.Slide[]=[];
  function slide(title:string,subtitle?:string){const s=pptx.addSlide();slides.push(s);s.background={color:"FFFFFF"};s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:width,h:.11,line:{color:navy},fill:{color:navy}});s.addText(title,{x:.72,y:.42,w:11.9,h:.54,fontFace:"Arial",fontSize:27,bold:true,color:navy,margin:0,breakLine:false});if(subtitle)s.addText(subtitle,{x:.73,y:1.04,w:11.8,h:.38,fontFace:"Arial",fontSize:11,color:muted,margin:0});return s;}
  function footer(s:PptxGenJS.Slide){s.addShape(pptx.ShapeType.line,{x:.72,y:7.17,w:11.9,h:0,line:{color:line,width:1}});s.addText(`${kind} · ${snapshot.store_name}`,{x:.73,y:7.22,w:10.7,h:.18,fontFace:"Arial",fontSize:8,color:muted,margin:0});}
  function paragraphSlides(title:string,items:string[],subtitle?:string){const content=items.flatMap((item)=>pieces(item));let index=0;while(index<content.length){const s=slide(index===0?title:`${title} (forts.)`,subtitle);let y=1.63;while(index<content.length){const item=content[index],lines=Math.max(1,Math.ceil(item.length/88)),boxHeight=.4+Math.max(0,lines-1)*.32,rowHeight=Math.max(.76,boxHeight+.3);if(y+rowHeight>6.85&&y>1.63)break;s.addShape(pptx.ShapeType.ellipse,{x:.78,y:y+.12,w:.08,h:.08,line:{color:orange},fill:{color:orange}});s.addText(item,{x:1.04,y,w:11.3,h:boxHeight,fontFace:"Arial",fontSize:16,color:navy,margin:0,breakLine:false,valign:"middle"});y+=rowHeight;index++;}footer(s);}}

  const cover=slide(snapshot.store_name,`${snapshot.cooperative_name} · ${formatDate(snapshot.visit_date)} · Versjon ${snapshot.version_no}`);
  cover.addText(kind.toUpperCase(),{x:.74,y:1.8,w:11.7,h:.5,fontFace:"Arial",fontSize:16,bold:true,color:orange,margin:0});
  cover.addText(snapshot.kind==="inspection"?formatScore(snapshot.total):"Ikke gjeldende",{x:.72,y:2.52,w:5.5,h:1.25,fontFace:"Arial",fontSize:snapshot.kind==="inspection"?72:32,bold:true,color:bandColor(snapshot.total),margin:0});
  cover.addText(snapshot.kind==="inspection"?conceptLabel(snapshot.total):"Konseptkarakter er ikke gjeldende",{x:.75,y:3.82,w:10.5,h:.4,fontFace:"Arial",fontSize:20,bold:true,color:bandColor(snapshot.total),margin:0});
  cover.addText(`Vurderer: ${snapshot.assessor_name||"Ukjent"}`,{x:.75,y:5.2,w:10.5,h:.3,fontFace:"Arial",fontSize:14,color:muted,margin:0});footer(cover);

  paragraphSlides("Oppsummering",[snapshot.summary||"Ingen samlet kommentar."],snapshot.round_title||undefined);
  for(const area of areas){const assessment=snapshot.areas.find((item)=>item.key===area.key);if(!assessment)continue;const score=assessment.score_quarters==null?null:assessment.score_quarters/4;const s=slide(area.label,`${kind} · ${formatDate(snapshot.visit_date)}`);
    s.addText(snapshot.kind==="inspection"?formatScore(score):"Ikke gjeldende",{x:.74,y:1.66,w:5,h:.62,fontFace:"Arial",fontSize:snapshot.kind==="inspection"?34:20,bold:true,color:bandColor(score),margin:0});
    if(snapshot.kind==="inspection")s.addText(conceptLabel(score),{x:2.06,y:1.79,w:5,h:.35,fontFace:"Arial",fontSize:15,color:bandColor(score),margin:0});
    if(assessment.needs_follow_up)s.addText("Krever oppfølging",{x:.74,y:2.43,w:6,h:.28,fontFace:"Arial",fontSize:12,bold:true,color:orange,margin:0});
    const commentPieces=pieces(assessment.comment||"Ingen kommentar.",420);
    s.addText(commentPieces[0],{x:.74,y:assessment.needs_follow_up?2.93:2.56,w:11.7,h:3.4,fontFace:"Arial",fontSize:19,color:navy,margin:0,breakLine:false,valign:"top"});footer(s);
    if(commentPieces.length>1)paragraphSlides(`${area.label} · kommentar`,commentPieces.slice(1));
    for(let offset=0;offset<assessment.images.length;offset+=2){const photoSlide=slide(`${area.label} · bilder`,`${offset+1}–${Math.min(offset+2,assessment.images.length)} av ${assessment.images.length}`);let shown=0;
      for(const [i,image] of assessment.images.slice(offset,offset+2).entries()){
        try{const {data,error}=await supabase.storage.from("report-images").download(image.path);if(error||!data)throw error||new Error("Bilde mangler");const bytes=new Uint8Array(await data.arrayBuffer());const mime=image.path.toLowerCase().endsWith(".png")?"image/png":"image/jpeg";const x=.75+i*6.25;photoSlide.addImage({data:`data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,x,y:1.53,w:5.72,h:4.58,sizing:{type:"contain",w:5.72,h:4.58},altText:image.caption||`Bilde fra ${area.label}`});photoSlide.addText(clean(image.caption)||`Bilde ${offset+i+1}`,{x,y:6.24,w:5.72,h:.53,fontFace:"Arial",fontSize:12,color:muted,margin:0});shown++;}catch{photoSlide.addText("Bilde kunne ikke hentes",{x:.75+i*6.25,y:3,w:5.72,h:.4,fontFace:"Arial",fontSize:14,color:muted,margin:0});}
      }
      if(shown===0)photoSlide.addText("Bildene er tilgjengelige i nettversjonen.",{x:.75,y:4,w:11.6,h:.4,fontFace:"Arial",fontSize:14,color:muted,margin:0});footer(photoSlide);
    }
  }
  if(snapshot.kind==="inspection"){
    paragraphSlides("Slik leses karakteren",["Under 6: under konsept (rød)","6: konsept","Over 6: over konsept (grønn)","Fire områder teller likt i totalkarakteren."],"Vurderingskriterier fra originalmalen");
    for(const section of criteriaSections)paragraphSlides(`Karakter ${section.grade}`,[...section.points],"Vurderingskriterier fra originalmalen");
  }
  slides.forEach((s,i)=>s.addText(`${i+1} / ${slides.length}`,{x:12.12,y:7.21,w:.45,h:.2,fontFace:"Arial",fontSize:8,color:muted,margin:0,align:"right"}));
  const output=await pptx.write({outputType:"nodebuffer"});return new Uint8Array(output as Uint8Array);
}
