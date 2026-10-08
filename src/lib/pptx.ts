import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { areas, formatDate, formatScore } from "./scoring";
import { conceptBand, conceptLabel, criteriaSections } from "./criteria";
import { reportKindLabel } from "./report-kind";

type Snapshot = { kind:string;store_name:string;cooperative_name:string;round_title:string|null;visit_date:string;assessor_name:string;summary:string;total:number|null;version_no:number;areas:{key:string;score_quarters:number|null;comment:string;needs_follow_up:boolean;images:{path:string;caption:string}[]}[] };
const navy="142B43", orange="D66B28", green="236A4F", red="AD4944", muted="68788A", line="DCE4EB";
const width=13.333;
export const reportPptxTemplateVersion="area-flow-20261008";
export function reportPptxPath(versionId:string){return `reports/${versionId}-${reportPptxTemplateVersion}.pptx`;}
function bandColor(score:number|null){return conceptBand(score)==="below"?red:conceptBand(score)==="above"?green:navy;}
function clean(value:string){return value.replace(/[\u0000-\u001f]/g," ").trim();}
function pieces(value:string,max=320){const words=clean(value).split(/\s+/);const result:string[]=[];let current="";for(const word of words){if(current&&`${current} ${word}`.length>max){result.push(current);current=word;}else current=current?`${current} ${word}`:word;}if(current)result.push(current);return result.length?result:["Ingen kommentar."];}
export async function buildReportPptx(snapshot:Snapshot,supabase:SupabaseClient):Promise<Uint8Array>{
  const pptx=new PptxGenJS();pptx.layout="LAYOUT_WIDE";pptx.author="Driftssjekk";pptx.subject="Rapport fra varehus";pptx.title=`${snapshot.store_name} – ${snapshot.kind==="self_check"?"driftsgjennomgang":"konseptrunde"}`;
  pptx.theme={headFontFace:"Arial",bodyFontFace:"Arial"};
  const kind=reportKindLabel(snapshot.kind);
  const reportAreas=snapshot.kind==="event_check"?areas.filter((area)=>snapshot.areas.some((item)=>item.key===area.key)):areas;
  const partialEvent=snapshot.kind==="event_check"&&reportAreas.length<4;
  const slides:PptxGenJS.Slide[]=[];
  function slide(title:string,subtitle?:string){const s=pptx.addSlide();slides.push(s);s.background={color:"FFFFFF"};s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:width,h:.11,line:{color:navy},fill:{color:navy}});s.addText(title,{x:.72,y:.42,w:11.9,h:.54,fontFace:"Arial",fontSize:27,bold:true,color:navy,margin:0,breakLine:false});if(subtitle)s.addText(subtitle,{x:.73,y:1.04,w:11.8,h:.38,fontFace:"Arial",fontSize:11,color:muted,margin:0});return s;}
  function footer(s:PptxGenJS.Slide){s.addShape(pptx.ShapeType.line,{x:.72,y:7.17,w:11.9,h:0,line:{color:line,width:1}});s.addText(`${kind} · ${snapshot.store_name}`,{x:.73,y:7.22,w:10.7,h:.18,fontFace:"Arial",fontSize:8,color:muted,margin:0});}
  function paragraphSlides(title:string,items:string[],subtitle?:string){const content=items.flatMap((item)=>pieces(item)),created:PptxGenJS.Slide[]=[];let index=0;while(index<content.length){const s=slide(index===0?title:`${title} (forts.)`,subtitle);created.push(s);let y=1.63;while(index<content.length){const item=content[index],lines=Math.max(1,Math.ceil(item.length/88)),boxHeight=.4+Math.max(0,lines-1)*.32,rowHeight=Math.max(.76,boxHeight+.3);if(y+rowHeight>6.85&&y>1.63)break;s.addShape(pptx.ShapeType.ellipse,{x:.78,y:y+.12,w:.08,h:.08,line:{color:orange},fill:{color:orange}});s.addText(item,{x:1.04,y,w:11.3,h:boxHeight,fontFace:"Arial",fontSize:16,color:navy,margin:0,breakLine:false,valign:"middle"});y+=rowHeight;index++;}footer(s);}return created;}

  const cover=pptx.addSlide();slides.push(cover);cover.background={color:navy};
  cover.addShape(pptx.ShapeType.rect,{x:0,y:0,w:.16,h:7.5,line:{color:orange},fill:{color:orange}});
  cover.addText("DRIFTSSJEKK",{x:.78,y:.56,w:6,h:.3,fontFace:"Arial",fontSize:13,bold:true,color:"AAC0D0",charSpacing:2,margin:0});
  cover.addText(kind.toUpperCase(),{x:.78,y:1.38,w:11.6,h:.4,fontFace:"Arial",fontSize:17,bold:true,color:"F6A66F",margin:0});
  cover.addText(snapshot.store_name,{x:.75,y:1.94,w:11.55,h:.88,fontFace:"Arial",fontSize:35,bold:true,color:"FFFFFF",margin:0,fit:"shrink"});
  cover.addText(`${snapshot.cooperative_name}  ·  ${formatDate(snapshot.visit_date)}`,{x:.78,y:2.94,w:10.8,h:.33,fontFace:"Arial",fontSize:14,color:"BCD0DF",margin:0});
  cover.addShape(pptx.ShapeType.rect,{x:.78,y:3.75,w:5.15,h:2.14,line:{color:"35516C",width:1},fill:{color:"1D3A55"}});
  cover.addText(snapshot.kind==="self_check"?"DRIFTSKARAKTER":partialEvent?"DELVURDERING":"TOTALKARAKTER",{x:1.08,y:4.04,w:4.5,h:.28,fontFace:"Arial",fontSize:11,bold:true,color:"AFC3D3",charSpacing:1,margin:0});
  cover.addText(formatScore(snapshot.total),{x:1.05,y:4.48,w:4.6,h:.95,fontFace:"Arial",fontSize:snapshot.total==null?27:58,bold:true,color:"FFFFFF",margin:0});
  cover.addText(snapshot.kind!=="self_check"?(partialEvent?"Tildelte områder":conceptLabel(snapshot.total)):"Intern progresjon",{x:6.35,y:4.18,w:5.7,h:.57,fontFace:"Arial",fontSize:23,bold:true,color:snapshot.kind!=="self_check"?"FFFFFF":"BCD0DF",margin:0});
  cover.addText(`Vurderer: ${snapshot.assessor_name||"Ukjent"}\nVersjon ${snapshot.version_no}`,{x:6.37,y:5.03,w:5.7,h:.75,fontFace:"Arial",fontSize:13,color:"BCD0DF",margin:0,breakLine:false});
  cover.addShape(pptx.ShapeType.line,{x:.78,y:6.98,w:11.77,h:0,line:{color:"446178",width:1}});
  cover.addText("OBS BYGG  /  VAREHUSSTANDARD",{x:.78,y:7.09,w:8.8,h:.2,fontFace:"Arial",fontSize:9,bold:true,color:"AAC0D0",margin:0});

  const summarySlides=paragraphSlides("Oppsummering",[snapshot.summary||"Ingen samlet kommentar."],snapshot.round_title||undefined);
  if(summarySlides.length===1&&clean(snapshot.summary).length<=280){const s=summarySlides[0];s.addText("RESULTAT PER OMRÅDE",{x:.75,y:4.57,w:11,h:.25,fontFace:"Arial",fontSize:11,bold:true,color:muted,margin:0});
    reportAreas.forEach((area,index)=>{const assessment=snapshot.areas.find((item)=>item.key===area.key),score=assessment?.score_quarters==null?null:assessment.score_quarters/4,x=.75+index*3.12;s.addShape(pptx.ShapeType.rect,{x,y:4.95,w:2.94,h:1.05,line:{color:line,width:1},fill:{color:"F7F9FB"}});s.addText(area.label,{x:x+.17,y:5.12,w:2.6,h:.24,fontFace:"Arial",fontSize:11,bold:true,color:muted,margin:0});s.addText(formatScore(score),{x:x+.17,y:5.43,w:2.6,h:.37,fontFace:"Arial",fontSize:score==null?13:22,bold:true,color:snapshot.kind!=="self_check"?bandColor(score):navy,margin:0});});
  }
  for(const [areaIndex,area] of reportAreas.entries()){
    const assessment=snapshot.areas.find((item)=>item.key===area.key);
    if(!assessment)continue;
    const score=assessment.score_quarters==null?null:assessment.score_quarters/4;
    const areaSlide=slide(area.label,`OMRÅDE ${String(areaIndex+1).padStart(2,"0")} / ${reportAreas.length}   ·   ${kind}`);
    areaSlide.addShape(pptx.ShapeType.rect,{x:.75,y:1.57,w:3.28,h:4.98,line:{color:line,width:1},fill:{color:"F4F7FA"}});
    areaSlide.addShape(pptx.ShapeType.rect,{x:.75,y:1.57,w:.075,h:4.98,line:{color:snapshot.kind!=="self_check"?bandColor(score):navy},fill:{color:snapshot.kind!=="self_check"?bandColor(score):navy}});
    areaSlide.addText("KARAKTER",{x:1.08,y:1.94,w:2.55,h:.29,fontFace:"Arial",fontSize:11,bold:true,charSpacing:1.5,color:muted,margin:0});
    areaSlide.addText(formatScore(score),{x:1.04,y:2.43,w:2.7,h:1.22,fontFace:"Arial",fontSize:score==null?26:65,bold:true,color:snapshot.kind!=="self_check"?bandColor(score):navy,margin:0,fit:"shrink"});
    if(snapshot.kind!=="self_check")areaSlide.addText(conceptLabel(score),{x:1.09,y:3.86,w:2.58,h:.55,fontFace:"Arial",fontSize:16,bold:true,color:bandColor(score),margin:0,fit:"shrink"});
    if(assessment.needs_follow_up)areaSlide.addText("KREVER OPPFØLGING",{x:1.09,y:5.72,w:2.6,h:.34,fontFace:"Arial",fontSize:10,bold:true,color:orange,margin:0});
    areaSlide.addText("VURDERING",{x:4.48,y:1.78,w:7.82,h:.31,fontFace:"Arial",fontSize:11,bold:true,charSpacing:1.3,color:muted,margin:0});
    const commentChunks=pieces(assessment.comment||"Ingen kommentar.",510);
    areaSlide.addText(commentChunks[0],{x:4.47,y:2.25,w:7.58,h:3.93,fontFace:"Arial",fontSize:20,color:navy,margin:0,breakLine:false,fit:"shrink",valign:"top"});
    areaSlide.addShape(pptx.ShapeType.line,{x:4.47,y:6.31,w:7.84,h:0,line:{color:line,width:1}});
    areaSlide.addText(`${assessment.images.length} ${assessment.images.length===1?"bilde":"bilder"} fra området`,{x:4.47,y:6.45,w:7.8,h:.25,fontFace:"Arial",fontSize:11,color:muted,margin:0});
    footer(areaSlide);
    if(commentChunks.length>1)paragraphSlides(`${area.label} · vurdering`,commentChunks.slice(1),`OMRÅDE ${String(areaIndex+1).padStart(2,"0")} / ${reportAreas.length}`);
    for(const [index,image] of assessment.images.entries()){
      const photoSlide=slide(area.label,`Dokumentasjon · bilde ${index+1} av ${assessment.images.length}`);
      try{
        const {data,error}=await supabase.storage.from("report-images").download(image.path);
        if(error||!data)throw error||new Error("Bilde mangler");
        const converted=await sharp(Buffer.from(await data.arrayBuffer())).rotate().jpeg({quality:88}).toBuffer();
        const metadata=await sharp(converted).metadata();
        if(!metadata.width||!metadata.height)throw new Error("Ugyldige bildemål");
        const portrait=metadata.height>metadata.width;
        const box=portrait?{x:.78,y:1.55,w:7.0,h:5.15}:{x:.78,y:1.53,w:11.75,h:4.83};
        photoSlide.addShape(pptx.ShapeType.rect,{x:box.x,y:box.y,w:box.w,h:box.h,line:{color:line,width:1},fill:{color:"F4F7F9"}});
        const scale=Math.min(box.w/metadata.width,box.h/metadata.height);
        const imageWidth=metadata.width*scale,imageHeight=metadata.height*scale;
        photoSlide.addImage({data:`data:image/jpeg;base64,${converted.toString("base64")}`,x:box.x+(box.w-imageWidth)/2,y:box.y+(box.h-imageHeight)/2,w:imageWidth,h:imageHeight,altText:image.caption||`Bilde fra ${area.label}`});
        if(portrait){
          photoSlide.addShape(pptx.ShapeType.rect,{x:8.12,y:1.55,w:4.38,h:5.15,line:{color:line,width:1},fill:{color:"F9FBFC"}});
          photoSlide.addText("BILDETEKST",{x:8.45,y:1.92,w:3.68,h:.28,fontFace:"Arial",fontSize:11,bold:true,color:muted,margin:0});
          photoSlide.addText(clean(image.caption)||"Dokumentasjon fra området",{x:8.45,y:2.36,w:3.68,h:2.8,fontFace:"Arial",fontSize:20,bold:true,color:navy,margin:0,fit:"shrink",valign:"top"});
        }else{
          photoSlide.addText(clean(image.caption)||"Dokumentasjon fra området",{x:.8,y:6.48,w:11.7,h:.38,fontFace:"Arial",fontSize:13,bold:true,color:navy,margin:0,fit:"shrink"});
        }
      }catch{photoSlide.addText("Bilde kunne ikke hentes",{x:.8,y:3,w:11.5,h:.4,fontFace:"Arial",fontSize:16,color:muted,margin:0});}
      footer(photoSlide);
    }
  }
  if(snapshot.kind!=="self_check"){
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
