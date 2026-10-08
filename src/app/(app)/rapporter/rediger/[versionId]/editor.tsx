"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Save, Send, AlertCircle } from "lucide-react";
import { areas, averageFromQuarters, formatScore, quartersFromInput, totalFromQuarters, type AreaKey } from "@/lib/scoring";
import type { Area, Report, Version } from "@/lib/data";
import { createClient } from "@/lib/supabase/browser";
import ImageMarker from "@/components/image-marker";
import EditableReportImage, { type EditableImageInfo } from "@/components/editable-report-image";
import { mergeDraft, type DraftFields } from "@/lib/draft-merge";
import { reportKindLabel } from "@/lib/report-kind";

type Editable = DraftFields["areas"];
type RemoteDraft = {state:string;lockVersion:number;updatedAt:string|null;fields:DraftFields;images:EditableImageInfo[]};
export default function Editor({ version, report, assessments, images: initialImages, canDelete }: { version:Version; report:Report; assessments:Area[]; images:EditableImageInfo[]; canDelete:boolean }) {
  const router = useRouter();
  const initial = Object.fromEntries(areas.map((a) => { const row = assessments.find((v) => v.area_key === a.key); return [a.key,{score_quarters:row?.score_quarters ?? null,comment:row?.comment || "",needs_follow_up:row?.needs_follow_up || false}]; })) as Editable;
  const [data,setData] = useState<Editable>(initial);
  const [scoreText,setScoreText] = useState<Record<AreaKey,string>>(Object.fromEntries(areas.map((a) => [a.key,initial[a.key].score_quarters == null ? "" : formatScore(initial[a.key].score_quarters!/4)])) as Record<AreaKey,string>);
  const [visitDate,setVisitDate] = useState(version.visit_date || ""); const [summary,setSummary] = useState(version.summary || "");
  const [imageList,setImageList] = useState(initialImages);
  const [pendingImage,setPendingImage] = useState<{key:AreaKey;file:File}|null>(null);
  const [editingImage,setEditingImage] = useState<{image:EditableImageInfo;file:File}|null>(null);
  const lockRef = useRef(version.lock_version);
  const baseRef = useRef<DraftFields>({visitDate:version.visit_date || "",summary:version.summary || "",areas:initial});
  const [conflict,setConflict] = useState<{latest:RemoteDraft;base:DraftFields}|null>(null);
  const [state,setState] = useState("Lagret"); const [error,setError] = useState(""); const [reason,setReason] = useState("");
  const [retryTick,setRetryTick] = useState(0);
  const dirtyRef = useRef(false); const savingRef = useRef(false); const revisionRef = useRef(0); const mounted = useRef(false);
  const [savedAt,setSavedAt] = useState<string | null>(version.updated_at || null);
  const visibleAreas = useMemo(() => report.event_id
    ? areas.filter((area) => assessments.some((row) => row.area_key === area.key)) : areas,
  [assessments, report.event_id]);
  const completed = visibleAreas.filter((a) => data[a.key].score_quarters !== null).length;
  const total = completed === visibleAreas.length
    ? report.event_id ? averageFromQuarters(visibleAreas.map((area) => data[area.key].score_quarters!)) : totalFromQuarters(visibleAreas.map((area) => data[area.key].score_quarters!))
    : null;
  const conflictingFields = conflict ? mergeDraft(conflict.base,{visitDate,summary,areas:data},conflict.latest.fields).conflicts : [];
  const markDirty = () => { dirtyRef.current = true; revisionRef.current++; setState("Ikke lagret"); };
  const changeArea = (key:AreaKey, patch:Partial<Editable[AreaKey]>) => { setData((old) => ({...old,[key]:{...old[key],...patch}})); markDirty(); };
  const applyFields = (fields:DraftFields) => {
    setData(fields.areas);setVisitDate(fields.visitDate);setSummary(fields.summary);
    setScoreText(Object.fromEntries(areas.map((area)=>[area.key,fields.areas[area.key].score_quarters===null?"":formatScore(fields.areas[area.key].score_quarters!/4)])) as Record<AreaKey,string>);
  };
  const save = useCallback(async () => {
    if (savingRef.current) return false;
    if (conflict) {setError("Velg hvilken utgave av de motstridende feltene som skal brukes.");return false;}
    if (visibleAreas.some((a) => scoreText[a.key].trim() !== "" && quartersFromInput(scoreText[a.key]) === null)) {
      setError("Bruk karakterer fra 1,00 til 10,00 i intervaller på 0,25."); return false;
    }
    if (!dirtyRef.current) return true;
    savingRef.current = true; setState("Lagrer …"); setError(""); const revision = revisionRef.current;
    const values:DraftFields={visitDate,summary,areas:data};
    try {
      const response = await fetch(`/api/reports/${version.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({lockVersion:lockRef.current,visitDate:values.visitDate || null,summary:values.summary,areas:values.areas})});
      const result = await response.json();
      if (response.status===409) {
        const latestResponse=await fetch(`/api/reports/${version.id}`,{cache:"no-store"});
        if (!latestResponse.ok) throw new Error("Kunne ikke hente kollegaens endringer. Prøv igjen.");
        const latest=await latestResponse.json() as RemoteDraft;
        if (latest.state!=="draft") throw new Error("Kladden er publisert av en kollega. Kopier eventuelle ulagrede notater før du åpner rapporten på nytt.");
        if (revision!==revisionRef.current) throw new Error("Du endret kladden under synkronisering. Trykk Lagre kladd igjen.");
        const merged=mergeDraft(baseRef.current,values,latest.fields);
        if (merged.conflicts.length) {
          setConflict({latest,base:baseRef.current});
          setError(`Begge har endret ${merged.conflicts.join(", ")}. Velg hvilken utgave som skal beholdes.`);
          return false;
        }
        baseRef.current=latest.fields;lockRef.current=latest.lockVersion;setImageList(latest.images);
        applyFields(merged.merged);markDirty();setState("Endringer fra kollega er flettet inn");
        return false;
      }
      if (!response.ok) throw new Error(result.error || "Lagring feilet");
      lockRef.current = result.lockVersion; baseRef.current=values;setSavedAt(new Date().toISOString());
      if (revision === revisionRef.current) { dirtyRef.current = false; setState("Lagret"); } else setState("Nye endringer venter på lagring");
      return true;
    } catch (e) { setState("Ikke lagret"); setError(e instanceof Error ? e.message : "Lagring feilet"); return false; }
    finally { savingRef.current = false; if (revisionRef.current!==revision && dirtyRef.current) setRetryTick((old)=>old+1); }
  },[data,visitDate,summary,scoreText,version.id,conflict,visibleAreas]);
  useEffect(() => { if (!mounted.current) { mounted.current = true; return; } if (!dirtyRef.current) return; const timer = window.setTimeout(() => { void save(); },1100); return () => clearTimeout(timer); },[data,visitDate,summary,scoreText,save,retryTick]);
  useEffect(() => { const handler = (event:BeforeUnloadEvent) => { if (dirtyRef.current) event.preventDefault(); }; window.addEventListener("beforeunload",handler); return () => window.removeEventListener("beforeunload",handler); },[]);
  useEffect(() => {
    const timer=window.setInterval(async()=>{
      if (dirtyRef.current||savingRef.current||conflict) return;
      try {
        const response=await fetch(`/api/reports/${version.id}`,{cache:"no-store"});if(!response.ok)return;
        const latest=await response.json() as RemoteDraft;
        if(latest.state!=="draft") {router.refresh();return;}
        if(latest.lockVersion!==lockRef.current) {lockRef.current=latest.lockVersion;baseRef.current=latest.fields;applyFields(latest.fields);setSavedAt(latest.updatedAt);setState("Oppdatert av kollega");}
        setImageList(latest.images);
      } catch { /* Network interruptions are handled by the next sync or save. */ }
    },10000);
    return()=>window.clearInterval(timer);
  // Recreate the timer only when its target changes or a conflict is open.
  },[version.id,conflict,router]);
  function resolveConflict(prefer:"mine"|"theirs") {
    if(!conflict)return;
    const merged=mergeDraft(conflict.base,{visitDate,summary,areas:data},conflict.latest.fields,prefer).merged;
    baseRef.current=conflict.latest.fields;lockRef.current=conflict.latest.lockVersion;
    setImageList(conflict.latest.images);applyFields(merged);setConflict(null);setError("");markDirty();
  }
  async function publish() {
    if (!visitDate || completed !== visibleAreas.length) {setError("Sett besøksdato og vurder alle tildelte områder før publisering.");return;}
    if (version.version_no > 1 && !reason.trim()) {setError("Skriv hvorfor rapporten korrigeres.");return;}
    const saved = await save(); if (!saved || dirtyRef.current) return;
    if (!confirm(`Publisere ${report.event_id ? "vurderingen fra samlingen" : report.kind === "inspection" ? "konseptsjekken" : "driftsgjennomgangen"}? Den publiserte versjonen kan ikke redigeres direkte.`)) return;
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
  async function upload(key:AreaKey, blob:Blob, caption:string) {
    setError("");
    if(blob.size>10485760) throw new Error("Bildet er over grensen på 10 MB. Velg et mindre bilde.");
    const path = `${version.id}/${crypto.randomUUID()}.jpg`;
    const client = createClient();
    let stored = false;
    try {
      const {error:uploadError} = await client.storage.from("report-images").upload(path,blob,{contentType:"image/jpeg",upsert:false});
      if (uploadError) throw uploadError;
      stored = true;
      const response = await fetch(`/api/reports/${version.id}/images`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({area:key,path,caption,type:"image/jpeg",size:blob.size})});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Kunne ikke lagre bildet");
      const {data:signed} = await client.storage.from("report-images").createSignedUrl(path,300);
      setImageList((old) => [...old,{id:result.id,area_key:key,caption,path,url:signed?.signedUrl || ""}]);
      setPendingImage(null);
    } catch(e) {
      if (stored) await client.storage.from("report-images").remove([path]);
      throw e;
    }
  }
  async function beginImageEdit(image:EditableImageInfo) {
    setError("");
    try {
      const response=await fetch(image.url);
      if(!response.ok) throw new Error("Bildet kunne ikke åpnes. Last inn kladden på nytt og prøv igjen.");
      const blob=await response.blob();
      setEditingImage({image,file:new File([blob],"bilde.jpg",{type:blob.type || "image/jpeg"})});
    } catch(issue) {setError(issue instanceof Error?issue.message:"Bildet kunne ikke åpnes.");}
  }
  async function replaceImage(blob:Blob,caption:string) {
    if(!editingImage)return;
    if(blob.size>10485760) throw new Error("Bildet er over grensen på 10 MB.");
    const path=`${version.id}/${crypto.randomUUID()}.jpg`, client=createClient();
    let stored=false,committed=false;
    try {
      const {error:uploadError}=await client.storage.from("report-images").upload(path,blob,{contentType:"image/jpeg",upsert:false});
      if(uploadError)throw uploadError;
      stored=true;
      const response=await fetch(`/api/images/${editingImage.image.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedPath:editingImage.image.path,expectedCaption:editingImage.image.caption,path,caption,size:blob.size})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error || "Bildet kunne ikke lagres.");
      committed=true;
      setImageList((old)=>old.map((item)=>item.id===editingImage.image.id?{...item,path:result.path,caption:result.caption,url:result.url || item.url}:item));
      setEditingImage(null);
    } catch(issue) {
      if(stored&&!committed)await client.storage.from("report-images").remove([path]);
      throw issue;
    }
  }
  return <div className="editor-grid"><div>{report.kind === "inspection" && !report.event_id && <p className="feedback" style={{marginBottom:16}}>Dette er en felles kladd for driftssjefer med tilgang til varehuset. Dere kan overta hverandres arbeid.</p>}<section className="area-card"><label className="field">Besøksdato<input type="date" value={visitDate} onChange={(e) => {setVisitDate(e.target.value);markDirty();}} /></label></section>{visibleAreas.map((area,index) => <section className="area-card" key={area.key}><div className="area-heading"><div><p className="eyebrow">Område {index+1} av {visibleAreas.length}</p><h2>{area.label}</h2></div><span className="status">{data[area.key].score_quarters === null ? "Ikke vurdert" : "Vurdert"}</span></div><label className="field">Karakter<div className="score-control"><button type="button" aria-label={`Reduser karakter for ${area.label}`} onClick={() => {const next=Math.max(4,(data[area.key].score_quarters ?? 4)-1);changeArea(area.key,{score_quarters:next});setScoreText((old) => ({...old,[area.key]:formatScore(next/4)}));}}>−</button><input inputMode="decimal" aria-label={`Karakter for ${area.label}`} placeholder="Ikke vurdert" value={scoreText[area.key]} onChange={(e) => {const text=e.target.value;setScoreText((old) => ({...old,[area.key]:text}));const q=text.trim()===""?null:quartersFromInput(text);if (q!==null || text.trim()==="") changeArea(area.key,{score_quarters:q}); else { markDirty(); setError("Bruk karakterer fra 1,00 til 10,00 i intervaller på 0,25."); }}}/><button type="button" aria-label={`Øk karakter for ${area.label}`} onClick={() => {const next=Math.min(40,(data[area.key].score_quarters ?? 3)+1);changeArea(area.key,{score_quarters:next});setScoreText((old) => ({...old,[area.key]:formatScore(next/4)}));}}>+</button></div></label><label className="field">Kommentar<textarea value={data[area.key].comment} onChange={(e) => changeArea(area.key,{comment:e.target.value})} placeholder="Hva fungerer godt? Hva bør forbedres?" /></label><label style={{display:"flex",alignItems:"center",gap:8,marginTop:16,fontSize:14}}><input type="checkbox" checked={data[area.key].needs_follow_up} onChange={(e) => changeArea(area.key,{needs_follow_up:e.target.checked})}/> Krever oppfølging</label><div style={{marginTop:20}}><div className="photo-section-title"><strong>Bilder</strong><span>{imageList.filter((i) => i.area_key === area.key).length} av 20 bilder</span></div><div className="image-grid">{imageList.filter((i) => i.area_key === area.key).map((image) => <EditableReportImage key={image.id} image={image} areaLabel={area.label} onSaved={(id, caption) => setImageList((old) => old.map((item) => item.id === id ? {...item,caption} : item))} onEditImage={(item) => void beginImageEdit(item)} onRemove={(id) => void removeImage(id)} />)}</div><label className="photo-label"><Camera size={19}/><span><strong>Legg til bilde</strong><small>JPEG, PNG, WebP eller HEIC · maks 10 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" aria-label={`Legg til bilde for ${area.label}`} disabled={imageList.filter((i) => i.area_key === area.key).length >= 20} onChange={(e) => {const file=e.target.files?.[0];if(file) { if (!["image/jpeg","image/png","image/webp","image/heic","image/heif"].includes(file.type) || file.size > 10485760) setError("Velg JPEG, PNG, WebP eller HEIC på maks 10 MB."); else setPendingImage({key:area.key,file}); }e.target.value="";}} /></label></div></section>)}<section className="area-card"><div className="field"><h2>Oppsummering</h2><textarea aria-label="Oppsummering" value={summary} onChange={(e) => {setSummary(e.target.value);markDirty();}} placeholder="Oppsummer de viktigste observasjonene" /></div>{version.version_no > 1 && <label className="field" style={{marginTop:16}}>Begrunnelse for korrigering<textarea required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Hva er endret, og hvorfor?" /></label>}</section></div><aside className="summary-box"><section className="panel" style={{marginTop:0}}><p className="eyebrow">Rapportutkast</p><h2>{reportKindLabel(report.kind, report.event_id)}</h2><p className="muted">{`${completed} av ${visibleAreas.length} områder vurdert`}</p><div className="progress-track"><div className="progress-fill" style={{width:`${visibleAreas.length ? completed/visibleAreas.length*100 : 0}%`}}/></div><div style={{margin:"25px 0"}}>{visibleAreas.map((a) => <div key={a.key} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--line)",fontSize:13}}><span>{a.label}</span><strong>{formatScore(data[a.key].score_quarters == null?null:data[a.key].score_quarters!/4)}</strong></div>)}</div><p className="small" style={{margin:"0 0 18px"}}><strong>Samlet karakter: {formatScore(total)}</strong>{report.event_id ? <span className="muted"> · Utenfor offisiell måling</span> : report.kind === "self_check" && <span className="muted"> · Kun intern progresjon</span>}</p><p className="muted small">{state}{savedAt && state === "Lagret" ? ` · ${new Intl.DateTimeFormat("nb-NO",{timeZone:"Europe/Oslo",dateStyle:"short",timeStyle:"short"}).format(new Date(savedAt))}` : ""}</p>{error && <p role="alert" className="feedback error"><AlertCircle size={15}/> {error}</p>}{conflict && <div className="feedback error" role="alert"><p>Begge har endret {conflictingFields.join(", ")}. Velg hvilke endringer som skal gjelde før kladden lagres.</p><div className="page-actions"><button className="button" onClick={() => resolveConflict("theirs")}>Bruk kollegaens i disse feltene</button><button className="button" onClick={() => resolveConflict("mine")}>Behold mine i disse feltene</button></div></div>}<button className="button" style={{width:"100%",marginBottom:9}} onClick={() => void save()}><Save size={16}/> Lagre kladd</button><button className="button primary" style={{width:"100%"}} onClick={() => void publish()} disabled={!visitDate || completed!==visibleAreas.length}><Send size={16}/> Publiser rapport</button>{canDelete && <button className="button danger" style={{width:"100%",marginTop:9}} onClick={() => void deleteReport()}>Slett kladd permanent</button>}<p className="muted small" style={{marginTop:14,marginBottom:0}}>Publisering låser denne versjonen. Korrigeringer blir en ny versjon.</p></section></aside>{pendingImage && <ImageMarker file={pendingImage.file} onCancel={() => setPendingImage(null)} onSave={(blob, caption) => upload(pendingImage.key,blob,caption)}/>} {editingImage && <ImageMarker key={editingImage.image.id} file={editingImage.file} initialCaption={editingImage.image.caption} editing onCancel={() => setEditingImage(null)} onSave={replaceImage}/>}</div>;
}
