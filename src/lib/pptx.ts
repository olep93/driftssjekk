import PptxGenJS from "pptxgenjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { areas, formatDate, formatScore } from "./scoring";
import { conceptBand, conceptLabel, criteriaSections } from "./criteria";

type Snapshot = { kind:string;store_name:string;cooperative_name:string;round_title:string|null;visit_date:string;assessor_name:string;summary:string;total:number|null;version_no:number;areas:{key:string;score_quarters:number|null;comment:string;needs_follow_up:boolean;images:{path:string;caption:string}[]}[] };
const navy="142B43", orange="D66B28", green="236A4F", red="AD4944", muted="68788A", line="DCE4EB";
const width=13.333;
export const reportPptxTemplateVersion="monthly-scores-20261008";
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
  function paragraphSlides(title:string,items:string[],subtitle?:string){const content=items.flatMap((item)=>pieces(item)),created:PptxGenJS.Slide[]=[];let index=0;while(index<content.length){const s=slide(index===0?title:`${title} (forts.)`,subtitle);created.push(s);let y=1.63;while(index<content.length){const item=content[index],lines=Math.max(1,Math.ceil(item.length/88)),boxHeight=.4+Math.max(0,lines-1)*.32,rowHeight=Math.max(.76,boxHeight+.3);if(y+rowHeight>6.85&&y>1.63)break;s.addShape(pptx.ShapeType.ellipse,{x:.78,y:y+.12,w:.08,h:.08,line:{color:orange},fill:{color:orange}});s.addText(item,{x:1.04,y,w:11.3,h:boxHeight,fontFace:"Arial",fontSize:16,color:navy,margin:0,breakLine:false,valign:"middle"});y+=rowHeight;index++;}footer(s);}return created;}

  const cover=slide(snapshot.store_name,`${snapshot.cooperative_name} · ${formatDate(snapshot.visit_date)} · Versjon ${snapshot.version_no}`);
  cover.addText(kind.toUpperCase(),{x:.74,y:1.8,w:11.7,h:.5,fontFace:"Arial",fontSize:16,bold:true,color:orange,margin:0});
  cover.addText(formatScore(snapshot.total),{x:.72,y:2.52,w:5.5,h:1.25,fontFace:"Arial",fontSize:snapshot.total==null?32:72,bold:true,color:snapshot.kind==="inspection"?bandColor(snapshot.total):navy,margin:0});
  cover.addText(snapshot.kind==="inspection"?conceptLabel(snapshot.total):"Intern progresjon · utenfor konseptrangeringen",{x:.75,y:3.82,w:10.5,h:.4,fontFace:"Arial",fontSize:20,bold:true,color:snapshot.kind==="inspection"?bandColor(snapshot.total):navy,margin:0});
  cover.addText(`Vurderer: ${snapshot.assessor_name||"Ukjent"}`,{x:.75,y:5.2,w:10.5,h:.3,fontFace:"Arial",fontSize:14,color:muted,margin:0});footer(cover);

  const summarySlides=paragraphSlides("Oppsummering",[snapshot.summary||"Ingen samlet kommentar."],snapshot.round_title||undefined);
  if(summarySlides.length===1&&clean(snapshot.summary).length<=280){const s=summarySlides[0];s.addText("RESULTAT PER OMRÅDE",{x:.75,y:4.57,w:11,h:.25,fontFace:"Arial",fontSize:11,bold:true,color:muted,margin:0});
    areas.forEach((area,index)=>{const assessment=snapshot.areas.find((item)=>item.key===area.key),score=assessment?.score_quarters==null?null:assessment.score_quarters/4,x=.75+index*3.12;s.addShape(pptx.ShapeType.rect,{x,y:4.95,w:2.94,h:1.05,line:{color:line,width:1},fill:{color:"F7F9FB"}});s.addText(area.label,{x:x+.17,y:5.12,w:2.6,h:.24,fontFace:"Arial",fontSize:11,bold:true,color:muted,margin:0});s.addText(formatScore(score),{x:x+.17,y:5.43,w:2.6,h:.37,fontFace:"Arial",fontSize:score==null?13:22,bold:true,color:snapshot.kind==="inspection"?bandColor(score):navy,margin:0});});
  }
  const compactAreas=areas.every((area)=>{const assessment=snapshot.areas.find((item)=>item.key===area.key);return !assessment?.needs_follow_up&&clean(assessment?.comment||"").length<=110;});
  const areaBatch=compactAreas?4:2;
  for(let offset=0;offset<areas.length;offset+=areaBatch){const s=slide("Områdevurderinger",`${kind} · ${formatDate(snapshot.visit_date)}`);
    for(const [index,area] of areas.slice(offset,offset+areaBatch).entries()){const assessment=snapshot.areas.find((item)=>item.key===area.key),score=assessment?.score_quarters==null?null:assessment.score_quarters/4,y=compactAreas?1.58+index*1.28:1.62+index*2.55;
      s.addShape(pptx.ShapeType.rect,{x:.74,y,w:11.85,h:compactAreas?1.16:2.34,line:{color:line,width:1},fill:{color:"F9FBFC"}});
      s.addText(area.label,{x:1.02,y:y+(compactAreas ? .16 : .23),w:7.7,h:.4,fontFace:"Arial",fontSize:compactAreas?16:19,bold:true,color:navy,margin:0});
      s.addText(formatScore(score),{x:9.15,y:y+(compactAreas ? .16 : .23),w:3.15,h:.4,fontFace:"Arial",fontSize:score==null?16:(compactAreas?20:24),bold:true,color:snapshot.kind==="inspection"?bandColor(score):navy,align:"right",margin:0});
      if(assessment?.needs_follow_up)s.addText("Krever oppfølging",{x:1.02,y:y+.7,w:5,h:.25,fontFace:"Arial",fontSize:11,bold:true,color:orange,margin:0});
      const commentPieces=pieces(assessment?.comment||"Ingen kommentar.",compactAreas?110:260);
      s.addText(commentPieces[0],{x:1.02,y:y+(compactAreas ? .62 : assessment?.needs_follow_up ? .99 : .84),w:11.1,h:compactAreas ? .42 : 1.18,fontFace:"Arial",fontSize:compactAreas?13.5:16,color:navy,margin:0,fit:"shrink",valign:"top"});
      if(commentPieces.length>1)paragraphSlides(`${area.label} · kommentar`,commentPieces.slice(1));
    }
    footer(s);
  }
  for(const area of areas){const assessment=snapshot.areas.find((item)=>item.key===area.key);if(!assessment)continue;
    for(let offset=0;offset<assessment.images.length;offset+=2){const photoSlide=slide(`${area.label} · bilder`,`${offset+1}–${Math.min(offset+2,assessment.images.length)} av ${assessment.images.length}`);let shown=0;
      for(const [i,image] of assessment.images.slice(offset,offset+2).entries()){
        try{const {data,error}=await supabase.storage.from("report-images").download(image.path);if(error||!data)throw error||new Error("Bilde mangler");const bytes=new Uint8Array(await data.arrayBuffer());const mime=image.path.toLowerCase().endsWith(".png")?"image/png":"image/jpeg";const x=.75+i*6.25;photoSlide.addImage({data:`data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,x,y:1.53,w:5.72,h:4.58,sizing:{type:"contain",w:5.72,h:4.58},altText:image.caption||`Bilde fra ${area.label}`});photoSlide.addText(clean(image.caption)||`Bilde ${offset+i+1}`,{x,y:6.24,w:5.72,h:.53,fontFace:"Arial",fontSize:12,color:muted,margin:0});shown++;}catch{photoSlide.addText("Bilde kunne ikke hentes",{x:.75+i*6.25,y:3,w:5.72,h:.4,fontFace:"Arial",fontSize:14,color:muted,margin:0});}
      }
      if(shown===0)photoSlide.addText("Bildene er tilgjengelige i nettversjonen.",{x:.75,y:4,w:11.6,h:.4,fontFace:"Arial",fontSize:14,color:muted,margin:0});footer(photoSlide);
    }
  }
  if(snapshot.kind==="inspection"){
    function criteriaSlide(left:typeof criteriaSections[number][],right:typeof criteriaSections[number][],part:number){
      const s=slide("Vurderingskriterier",`Originalmal · del ${part} av 2`);
      s.addText("Under 6: under konsept     6: konsept     Over 6: over konsept",{x:.75,y:1.43,w:11.7,h:.27,fontFace:"Arial",fontSize:11,bold:true,color:navy,margin:0});
      function column(sections:typeof criteriaSections[number][],x:number){
        let y=1.86;const w=5.75;
        for(const section of sections){
          const color=section.grade==="1–2"||section.grade==="3–5"?red:section.grade==="9"||section.grade==="10"?green:navy;
          s.addShape(pptx.ShapeType.line,{x,y:y+.34,w,h:0,line:{color:line,width:1}});
          s.addText(`Karakter ${section.grade}`,{x,y,w,h:.3,fontFace:"Arial",fontSize:15,bold:true,color,margin:0});y+=.43;
          for(const point of section.points){
            const h=Math.max(.21,pieces(point,54).length*.21+.02);
            s.addShape(pptx.ShapeType.ellipse,{x:x+.02,y:y+.075,w:.055,h:.055,line:{color:orange},fill:{color:orange}});
            s.addText(point,{x:x+.2,y,w:w-.2,h,fontFace:"Arial",fontSize:11,color:navy,margin:0,fit:"shrink",valign:"top"});
            y+=h+.04;
          }
          y+=.08;
        }
        if(y>6.95)throw new Error(`Vurderingskriteriene passer ikke på lysbildet: del ${part}, kolonne ${x}, høyde ${y.toFixed(2)}`);
      }
      column(left,.75);column(right,6.82);footer(s);
    }
    criteriaSlide([criteriaSections[0]],[criteriaSections[1]],1);
    criteriaSlide([criteriaSections[2]],[criteriaSections[3],criteriaSections[4]],2);
  }
  slides.forEach((s,i)=>s.addText(`${i+1} / ${slides.length}`,{x:12.12,y:7.21,w:.45,h:.2,fontFace:"Arial",fontSize:8,color:muted,margin:0,align:"right"}));
  const output=await pptx.write({outputType:"nodebuffer"});return new Uint8Array(output as Uint8Array);
}
