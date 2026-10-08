"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Pencil } from "lucide-react";
export default function ReportActions({reportId,versionId,archived,withdrawn,canCorrect,canDelete}:{reportId:string;versionId:string;archived:boolean;withdrawn:boolean;canCorrect:boolean;canDelete:boolean}){
  const router=useRouter();const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [withdrawReason,setWithdrawReason]=useState("");
  async function correct(){setBusy(true);setError("");const response=await fetch(`/api/reports/${reportId}/correct`,{method:"POST"});const result=await response.json();if(!response.ok){setError(result.error||"Kunne ikke korrigere");setBusy(false);return;}router.push(`/rapporter/rediger/${result.versionId}`);}
  async function retryPdf(){const response=await fetch(`/api/exports/${versionId}/retry`,{method:"POST"});const result=await response.json();setError(response.ok?"PDF-jobben er lagt i kø på nytt.":result.error||"Kunne ikke prøve igjen");}
  async function lifecycle(body:unknown){setError("");const response=await fetch(`/api/reports/${reportId}/lifecycle`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await response.json();if(!response.ok){setError(result.error||"Kunne ikke oppdatere rapporten");return;}router.refresh();}
  async function deleteReport(){if(prompt("Skriv SLETT for å slette rapporten og alle versjoner permanent.")!=="SLETT")return;setBusy(true);setError("");try{const response=await fetch(`/api/report-deletions/${reportId}`,{method:"DELETE"});const result=await response.json();if(!response.ok){setError(result.error||"Kunne ikke slette rapporten");return;}router.push("/rapporter");router.refresh();}catch{setError("Kunne ikke kontakte serveren.");}finally{setBusy(false);}}
  function startDownload(format:"pdf"|"pptx"){const anchor=document.createElement("a");anchor.href=`/api/exports/${versionId}/download?format=${format}`;anchor.download=`driftssjekk-${versionId}.${format}`;document.body.append(anchor);anchor.click();anchor.remove();}
  async function downloadPdf(){
    setBusy(true);setError("");
    try{
      const generation=await fetch(`/api/exports/${versionId}/generate`,{method:"POST"});
      const generated=await generation.json();
      if(generation.status===202){setError("PDF klargjøres. Prøv igjen om litt.");return;}
      if(!generation.ok){setError(generated.error||"Kunne ikke lage PDF");return;}
      startDownload("pdf");
    }catch{setError("Kunne ikke hente PDF. Kontroller nettforbindelsen og prøv igjen.");}
    finally{setBusy(false);}
  }
  async function downloadPowerpoint(){setBusy(true);setError("");try{const response=await fetch(`/api/exports/${versionId}/powerpoint`,{method:"POST"});const result=await response.json();if(!response.ok){setError(result.error||"Kunne ikke lage PowerPoint");return;}startDownload("pptx");}catch{setError("Kunne ikke hente PowerPoint. Prøv igjen.");}finally{setBusy(false);}}
  return <><button className="button no-print" onClick={()=>window.print()}><Printer size={16}/> Skriv ut</button><button className="button no-print" onClick={()=>void downloadPdf()} disabled={busy}>{busy?"Lager rapport …":"Last ned PDF"}</button><button className="button no-print" onClick={()=>void downloadPowerpoint()} disabled={busy}>Last ned PowerPoint</button>{canCorrect&&!withdrawn&&<button className="button primary no-print" onClick={correct} disabled={busy}><Pencil size={16}/> Korriger rapport</button>}{(canCorrect||canDelete)&&<details className="no-print" style={{width:"100%",marginTop:9}}><summary style={{cursor:"pointer",fontSize:13}}>Flere rapportvalg</summary>{canCorrect&&<><div className="page-actions" style={{marginTop:10}}><button className="button" onClick={()=>void lifecycle({operation:"archive",archived:!archived})}>{archived?"Gjenopprett fra arkiv":"Arkiver rapport"}</button><button className="button" onClick={()=>void retryPdf()}>Prøv PDF igjen</button></div>{!withdrawn&&<div className="filters" style={{marginTop:10}}><input value={withdrawReason} onChange={e=>setWithdrawReason(e.target.value)} placeholder="Begrunn tilbaketrekking" aria-label="Begrunn tilbaketrekking"/><button className="button" disabled={withdrawReason.trim().length<5} onClick={()=>{if(confirm("Trekke rapporten tilbake fra statistikken?"))void lifecycle({operation:"withdraw",reason:withdrawReason});}}>Trekk tilbake</button></div>}</>}{canDelete&&<button className="button danger" style={{marginTop:12}} disabled={busy} onClick={()=>void deleteReport()}>Slett rapport permanent</button>}</details>}{error&&<p role="alert" className="feedback error">{error}</p>}</>;
}
