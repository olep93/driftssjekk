"use client";
/* Private signed image URLs are rendered directly to preserve access controls. */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Save, Send, AlertCircle } from "lucide-react";
import { areas, formatScore, quartersFromInput, totalFromQuarters, type AreaKey } from "@/lib/scoring";
import type { Area, Report, Version } from "@/lib/data";
import { createClient } from "@/lib/supabase/browser";

type Editable = Record<AreaKey,{score_quarters:number|null;comment:string;needs_follow_up:boolean}>;
type ImageInfo = {id:string;area_key:string;caption:string;url:string};
export default function Editor({ version, report, assessments, images: initialImages, canDelete }: { version:Version; report:Report; assessments:Area[]; images:ImageInfo[]; canDelete:boolean }) {
  const router = useRouter();
  const initial = Object.fromEntries(areas.map((a) => { const row = assessments.find((v) => v.area_key === a.key); return [a.key,{score_quarters:row?.score_quarters ?? null,comment:row?.comment || "",needs_follow_up:row?.needs_follow_up || false}]; })) as Editable;
  const [data,setData] = useState<Editable>(initial);
  const [scoreText,setScoreText] = useState<Record<AreaKey,string>>(Object.fromEntries(areas.map((a) => [a.key,initial[a.key].score_quarters == null ? "" : formatScore(initial[a.key].score_quarters!/4)])) as Record<AreaKey,string>);
  const [visitDate,setVisitDate] = useState(version.visit_date || ""); const [summary,setSummary] = useState(version.summary || "");
  const [imageList,setImageList] = useState(initialImages); const [captions,setCaptions] = useState<Record<string,string>>({});
  const lockRef = useRef(version.lock_version);
  const [state,setState] = useState("Lagret"); const [error,setError] = useState(""); const [reason,setReason] = useState("");
  const dirtyRef = useRef(false); const savingRef = useRef(false); const revisionRef = useRef(0); const mounted = useRef(false);
  const [savedAt,setSavedAt] = useState<string | null>(version.updated_at || null);
  const completed = areas.filter((a) => data[a.key].score_quarters !== null).length;
  const total = completed === 4 ? totalFromQuarters(areas.map((a) => data[a.key].score_quarters!)) : null;
  const markDirty = () => { dirtyRef.current = true; revisionRef.current++; setState("Ikke lagret"); };
  const changeArea = (key:AreaKey, patch:Partial<Editable[AreaKey]>) => { setData((old) => ({...old,[key]:{...old[key],...patch}})); markDirty(); };
  const save = useCallback(async (source?: { data:Editable; visitDate:string; summary:string; scoreText:Record<AreaKey,string> }) => {
    if (savingRef.current) return false;
    const values = source || {data,visitDate,summary,scoreText};
    if (areas.some((a) => values.scoreText[a.key].trim() !== "" && quartersFromInput(values.scoreText[a.key]) === null)) {
      setError("Bruk karakterer fra 1,00 til 10,00 i intervaller på 0,25."); return false;
    }
    if (!dirtyRef.current) return true;
    savingRef.current = true; setState("Lagrer …"); setError(""); const revision = revisionRef.current;
    try {
      const response = await fetch(`/api/reports/${version.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({lockVersion:lockRef.current,visitDate:values.visitDate || null,summary:values.summary,areas:values.data})});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Lagring feilet");
      lockRef.current = result.lockVersion; setSavedAt(new Date().toISOString());
      if (revision === revisionRef.current) { dirtyRef.current = false; setState("Lagret"); } else setState("Nye endringer venter på lagring");
      return true;
    } catch (e) { setState("Ikke lagret"); setError(e instanceof Error ? e.message : "Lagring feilet"); return false; }
    finally { savingRef.current = false; }
  },[data,visitDate,summary,scoreText,version.id]);
  useEffect(() => { if (!mounted.current) { mounted.current = true; return; } if (!dirtyRef.current) return; const timer = window.setTimeout(() => { void save(); },1100); return () => clearTimeout(timer); },[data,visitDate,summary,scoreText,save]);
  useEffect(() => { const handler = (event:BeforeUnloadEvent) => { if (dirtyRef.current) event.preventDefault(); }; window.addEventListener("beforeunload",handler); return () => window.removeEventListener("beforeunload",handler); },[]);
  async function publish() {
    if (!visitDate || completed !== 4) {setError("Sett besøksdato og vurder alle fire områder før publisering.");return;}
    if (version.version_no > 1 && !reason.trim()) {setError("Skriv hvorfor rapporten korrigeres.");return;}
    const saved = await save(); if (!saved || dirtyRef.current) return;
    if (!confirm(`Publisere ${report.kind === "inspection" ? "konseptsjekken" : "driftsgjennomgangen"}? Den publiserte versjonen kan ikke redigeres direkte.`)) return;
    setState("Publiserer …"); setError("");
    const response = await fetch(`/api/reports/${version.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lockVersion:lockRef.current,reason:reason.trim() || null})});
    const result = await response.json(); if (!response.ok) {setState("Lagret");setError(result.error || "Publisering feilet");return;}
    router.push(`/rapporter/${result.reportId}`);router.refresh();
  }
  async function removeImage(id:string) {
    const response = await fetch(`/api/images/${id}`,{method:"DELETE"});
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Kunne ikke fjerne bildet"); return; }
    setImageList((old) => old.filter((image) => image.id !== id));
  }
  async function deleteReport() {
    if (prompt("Skriv SLETT for å slette kladden og alle versjoner permanent.") !== "SLETT") return;
    const response = await fetch(`/api/report-deletions/${report.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Kunne ikke slette rapporten"); return; }
    dirtyRef.current = false;
    router.push("/rapporter"); router.refresh();
  }
  async function upload(key:AreaKey, file:File) {
    setError("");
    if (!(["image/jpeg","image/png","image/webp"].includes(file.type)) || file.size > 10485760) {setError("Velg JPEG, PNG eller WebP på maks 10 MB. HEIC må konverteres før opplasting.");return;}
    try {
      const bitmap = await createImageBitmap(file); if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width * bitmap.height > 100_000_000) throw new Error("Ugyldige bildedimensjoner");
      const scale = Math.min(1,1600/Math.max(bitmap.width,bitmap.height)); const canvas = document.createElement("canvas");
      canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      canvas.getContext("2d")?.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Kunne ikke behandle bildet")),"image/jpeg",.84));
      const path = `${version.id}/${crypto.randomUUID()}.jpg`;
      const client = createClient(); const {error:uploadError} = await client.storage.from("report-images").upload(path,blob,{contentType:"image/jpeg",upsert:false});
      if (uploadError) throw uploadError;
      const caption = captions[key] || "";
      const response = await fetch(`/api/reports/${version.id}/images`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({area:key,path,caption,type:"image/jpeg",size:blob.size})});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Kunne ikke lagre bildet");
      const {data:signed} = await client.storage.from("report-images").createSignedUrl(path,300);
      setImageList((old) => [...old,{id:result.id,area_key:key,caption,url:signed?.signedUrl || ""}]);
      setCaptions((old) => ({...old,[key]:""}));
    } catch(e) {setError(e instanceof Error ? e.message : "Bildeopplasting feilet");}
  }
  return <div className="editor-grid"><div><section className="area-card"><label className="field">Besøksdato<input type="date" value={visitDate} onChange={(e) => {setVisitDate(e.target.value);markDirty();}} /></label></section>{areas.map((area,index) => <section className="area-card" key={area.key}><div className="area-heading"><div><p className="eyebrow">Område {index+1} av 4</p><h2>{area.label}</h2></div><span className="status">{data[area.key].score_quarters === null ? "Ikke vurdert" : "Vurdert"}</span></div><label className="field">Karakter<div className="score-control"><button type="button" aria-label={`Reduser karakter for ${area.label}`} onClick={() => {const next=Math.max(4,(data[area.key].score_quarters ?? 4)-1);changeArea(area.key,{score_quarters:next});setScoreText((old) => ({...old,[area.key]:formatScore(next/4)}));}}>−</button><input inputMode="decimal" aria-label={`Karakter for ${area.label}`} placeholder="Ikke vurdert" value={scoreText[area.key]} onChange={(e) => {const text=e.target.value;setScoreText((old) => ({...old,[area.key]:text}));const q=text.trim()===""?null:quartersFromInput(text);if (q!==null || text.trim()==="") changeArea(area.key,{score_quarters:q}); else { markDirty(); setError("Bruk karakterer fra 1,00 til 10,00 i intervaller på 0,25."); }}}/><button type="button" aria-label={`Øk karakter for ${area.label}`} onClick={() => {const next=Math.min(40,(data[area.key].score_quarters ?? 3)+1);changeArea(area.key,{score_quarters:next});setScoreText((old) => ({...old,[area.key]:formatScore(next/4)}));}}>+</button></div></label><label className="field">Kommentar<textarea value={data[area.key].comment} onChange={(e) => changeArea(area.key,{comment:e.target.value})} placeholder="Hva fungerer godt? Hva bør forbedres?" /></label><label style={{display:"flex",alignItems:"center",gap:8,marginTop:16,fontSize:14}}><input type="checkbox" checked={data[area.key].needs_follow_up} onChange={(e) => changeArea(area.key,{needs_follow_up:e.target.checked})}/> Krever oppfølging</label><div style={{marginTop:20}}><div className="photo-section-title"><strong>Bilder</strong><span>{imageList.filter((i) => i.area_key === area.key).length} av 20 bilder</span></div><div className="image-grid">{imageList.filter((i) => i.area_key === area.key).map((image) => <div className="image-item" key={image.id}><a href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={image.caption || `Bilde fra ${area.label}`}/></a><p>{image.caption}</p><button type="button" className="text-button" onClick={() => void removeImage(image.id)}>Fjern</button></div>)}</div><label className="field" style={{marginTop:12}}>Bildetekst (valgfritt)<input value={captions[area.key] || ""} onChange={(e) => setCaptions((old) => ({...old,[area.key]:e.target.value}))} /></label><label className="photo-label"><Camera size={19}/><span><strong>Legg til bilde</strong><small>JPEG, PNG eller WebP · maks 10 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Legg til bilde for ${area.label}`} disabled={imageList.filter((i) => i.area_key === area.key).length >= 20} onChange={(e) => {const file=e.target.files?.[0];if(file) void upload(area.key,file);e.target.value="";}} /></label></div></section>)}<section className="area-card"><div className="field"><h2>Oppsummering</h2><textarea aria-label="Oppsummering" value={summary} onChange={(e) => {setSummary(e.target.value);markDirty();}} placeholder="Oppsummer de viktigste observasjonene" /></div>{version.version_no > 1 && <label className="field" style={{marginTop:16}}>Begrunnelse for korrigering<textarea required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Hva er endret, og hvorfor?" /></label>}</section></div><aside className="summary-box"><section className="panel" style={{marginTop:0}}><p className="eyebrow">Rapportutkast</p><h2>{report.kind === "inspection" ? "Uanmeldt konseptsjekk" : "Månedlig driftsgjennomgang"}</h2><p className="muted">{`${completed} av 4 områder vurdert`}</p><div className="progress-track"><div className="progress-fill" style={{width:`${completed*25}%`}}/></div><div style={{margin:"25px 0"}}>{areas.map((a) => <div key={a.key} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--line)",fontSize:13}}><span>{a.label}</span><strong>{formatScore(data[a.key].score_quarters == null?null:data[a.key].score_quarters!/4)}</strong></div>)}</div><p className="small" style={{margin:"0 0 18px"}}><strong>Samlet karakter: {formatScore(total)}</strong>{report.kind === "self_check" && <span className="muted"> · Kun intern progresjon</span>}</p><p className="muted small">{state}{savedAt && state === "Lagret" ? ` · ${new Intl.DateTimeFormat("nb-NO",{timeZone:"Europe/Oslo",dateStyle:"short",timeStyle:"short"}).format(new Date(savedAt))}` : ""}</p>{error && <p role="alert" className="feedback error"><AlertCircle size={15}/> {error}</p>}<button className="button" style={{width:"100%",marginBottom:9}} onClick={() => void save()}><Save size={16}/> Lagre kladd</button><button className="button primary" style={{width:"100%"}} onClick={() => void publish()} disabled={!visitDate || completed!==4}><Send size={16}/> Publiser rapport</button>{canDelete && <button className="button danger" style={{width:"100%",marginTop:9}} onClick={() => void deleteReport()}>Slett kladd permanent</button>}<p className="muted small" style={{marginTop:14,marginBottom:0}}>Publisering låser denne versjonen. Korrigeringer blir en ny versjon.</p></section></aside></div>;
}
