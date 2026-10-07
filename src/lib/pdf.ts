import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { areas, formatDate, formatScore } from "./scoring";

type Snapshot = { kind:string;store_name:string;cooperative_name:string;round_title:string|null;visit_date:string;assessor_name:string;summary:string;total:number;version_no:number;areas:{key:string;score_quarters:number;comment:string;needs_follow_up:boolean;images:{path:string;caption:string}[]}[] };
const navy=rgb(.07,.15,.25),orange=rgb(.91,.46,.15),muted=rgb(.39,.45,.52),line=rgb(.86,.89,.91);
function printable(value:string){return value.replace(/[^\u0020-\u00ff\n]/g,"?");}
function splitLines(text:string,font:PDFFont,size:number,maxWidth:number){
  const lines:string[]=[];
  for(const paragraph of printable(text).split("\n")){
    if(!paragraph){lines.push("");continue;}
    let current="";
    for(const word of paragraph.split(/\s+/)){
      if(!word)continue;
      const candidate=current?`${current} ${word}`:word;
      if(font.widthOfTextAtSize(candidate,size)<=maxWidth){current=candidate;continue;}
      if(current){lines.push(current);current="";}
      if(font.widthOfTextAtSize(word,size)<=maxWidth){current=word;continue;}
      let piece="";
      for(const char of word){if(font.widthOfTextAtSize(piece+char,size)>maxWidth&&piece){lines.push(piece);piece="";}piece+=char;}
      current=piece;
    }
    lines.push(current);
  }
  return lines;
}
export async function buildReportPdf(snapshot:Snapshot,supabase:SupabaseClient):Promise<Uint8Array>{
  const pdf=await PDFDocument.create();const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const width=595.28,height=841.89,margin=47,contentWidth=width-2*margin;
  let page:PDFPage=pdf.addPage([width,height]);let y:number=height-margin;
  function newPage(){page=pdf.addPage([width,height]);y=height-margin;page.drawRectangle({x:0,y:height-10,width,height:10,color:navy});page.drawText(printable(snapshot.store_name).slice(0,70),{x:margin,y,size:9,font:bold,color:muted});y-=26;}
  function room(needed:number){if(y-needed<margin+26)newPage();}
  function text(value:string,size=10,font:PDFFont=regular,color=navy,space=14){
    for(const lineText of splitLines(value,font,size,contentWidth)){room(space);if(lineText)page.drawText(lineText,{x:margin,y,size,font,color});y-=space;}
  }
  page.drawRectangle({x:0,y:height-10,width,height:10,color:navy});
  text(snapshot.kind==="inspection"?"DRIFTSSJEKK":"EGENKONTROLL",10,bold,orange,21);
  text(snapshot.store_name,24,bold,navy,32);
  text(snapshot.cooperative_name+(snapshot.round_title?`  ·  ${snapshot.round_title}`:""),10,regular,muted,19);
  room(65);page.drawRectangle({x:margin,y:y-56,width:contentWidth,height:61,color:rgb(.96,.97,.98)});
  page.drawText("TOTALKARAKTER",{x:margin+15,y:y-15,size:9,font:bold,color:muted});
  page.drawText(formatScore(snapshot.total),{x:margin+15,y:y-43,size:25,font:bold,color:navy});
  page.drawText(`Besøk ${formatDate(snapshot.visit_date)}  ·  Versjon ${snapshot.version_no}`,{x:margin+190,y:y-36,size:10,font:regular,color:muted});y-=83;
  text(`Vurderer: ${snapshot.assessor_name||"Ukjent"}`,10,regular,muted,20);
  text("Oppsummering",14,bold,navy,23);
  text(snapshot.summary||"Ingen samlet kommentar.",10,regular,navy,14);y-=12;
  for(const area of areas){
    const a=snapshot.areas.find((item)=>item.key===area.key);if(!a)continue;
    room(55);page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:1,color:line});y-=24;
    page.drawText(area.label,{x:margin,y,size:15,font:bold,color:navy});
    page.drawText(formatScore(a.score_quarters/4),{x:width-margin-46,y,size:15,font:bold,color:orange});y-=25;
    if(a.needs_follow_up)text("Krever oppfølging",9,bold,orange,17);
    text(a.comment||"Ingen kommentar.",10,regular,navy,14);y-=8;
    for(const image of a.images){
      try{
        const {data,error}=await supabase.storage.from("report-images").download(image.path);
        if(error||!data)throw error||new Error("Bilde mangler");
        const bytes=await data.arrayBuffer();
        const embedded=image.path.toLowerCase().endsWith(".png")?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
        const dimensions=embedded.scale(Math.min(1,contentWidth/embedded.width,180/embedded.height));
        room(dimensions.height+38);page.drawImage(embedded,{x:margin,y:y-dimensions.height,width:dimensions.width,height:dimensions.height});y-=dimensions.height+10;
        if(image.caption)text(image.caption,9,regular,muted,13);y-=11;
      }catch{ text("Bilde er tilgjengelig i nettversjonen.",9,regular,muted,15); }
    }
  }
  const pages=pdf.getPages();pages.forEach((p,index)=>{p.drawLine({start:{x:margin,y:37},end:{x:width-margin,y:37},thickness:1,color:line});p.drawText(`Driftssjekk · ${printable(snapshot.store_name)}`,{x:margin,y:24,size:8,font:regular,color:muted});p.drawText(`${index+1} / ${pages.length}`,{x:width-margin-35,y:24,size:8,font:regular,color:muted});});
  return pdf.save();
}
