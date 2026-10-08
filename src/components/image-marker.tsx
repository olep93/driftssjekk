"use client";

import { useEffect, useRef, useState } from "react";

type Tool = "circle" | "pen" | "highlight";
type Point = { x: number; y: number };
type Stroke = { tool: Tool; points: Point[] };

export default function ImageMarker({ file, onSave, onCancel }: {
  file: File; onSave: (blob: Blob) => Promise<void>; onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<ImageBitmap | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<Tool>("circle");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);

  function paint() {
    const canvas = canvasRef.current, image = imageRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    for (const stroke of [...strokesRef.current,...(activeRef.current ? [activeRef.current] : [])]) {
      const first = stroke.points[0], last = stroke.points.at(-1);
      if (!first || !last) continue;
      ctx.lineCap="round";ctx.lineJoin="round";
      if (stroke.tool === "circle") {
        const radiusX=Math.abs(last.x-first.x),radiusY=Math.abs(last.y-first.y);
        ctx.beginPath();ctx.ellipse(first.x,first.y,Math.max(radiusX,2),Math.max(radiusY,2),0,0,2*Math.PI);
        ctx.strokeStyle="#e21d38";ctx.lineWidth=Math.max(5,canvas.width/230);ctx.stroke();
      } else {
        ctx.beginPath();ctx.moveTo(first.x,first.y);
        for (const point of stroke.points.slice(1)) ctx.lineTo(point.x,point.y);
        if (stroke.points.length===1) ctx.lineTo(first.x+.1,first.y+.1);
        ctx.strokeStyle=stroke.tool==="pen"?"#e21d38":"rgba(255,220,0,.38)";
        ctx.lineWidth=stroke.tool==="pen"?Math.max(4,canvas.width/280):Math.max(22,canvas.width/28);
        ctx.stroke();
      }
    }
  }
  useEffect(() => {
    let cancelled=false;
    createImageBitmap(file).then((image) => {
      if (cancelled) {image.close();return;}
      if (!image.width || !image.height || image.width*image.height>100_000_000) {image.close();setError("Bildet har ugyldige dimensjoner.");return;}
      imageRef.current=image;
      const scale=Math.min(1,1600/Math.max(image.width,image.height));
      const canvas=canvasRef.current;
      if (canvas) {canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));paint();setReady(true);}
    }).catch(() => setError("Kunne ikke åpne bildet."));
    return () => {cancelled=true;imageRef.current?.close();imageRef.current=null;};
  // The selected file stays fixed for the life of this dialog.
  },[file]);

  function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};
  }
  function end(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    strokesRef.current.push(activeRef.current);activeRef.current=null;setCount(strokesRef.current.length);paint();
  }
  async function save() {
    const canvas=canvasRef.current;if(!canvas)return;
    setBusy(true);setError("");
    try {
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob((value)=>value?resolve(value):reject(new Error("Kunne ikke behandle bildet")),"image/jpeg",.88));
      await onSave(blob);
    } catch (issue) {setError(issue instanceof Error?issue.message:"Kunne ikke lagre bildet");}
    finally {setBusy(false);}
  }
  return <div className="image-marker-backdrop" role="presentation"><section className="image-marker-dialog" role="dialog" aria-modal="true" aria-label="Marker bildet">
    <div className="image-marker-header"><div><h2>Marker bildet</h2><p className="muted small">Tegn på bildet før det lagres i rapporten. Merkingen vises også i PDF og PowerPoint.</p></div><button type="button" className="button" onClick={onCancel} disabled={busy}>Lukk</button></div>
    <div className="image-marker-tools" role="toolbar" aria-label="Tegneverktøy">
      <button type="button" className={`button ${tool==="circle"?"primary":""}`} onClick={()=>setTool("circle")}>Rød sirkel</button>
      <button type="button" className={`button ${tool==="pen"?"primary":""}`} onClick={()=>setTool("pen")}>Rød penn</button>
      <button type="button" className={`button ${tool==="highlight"?"primary":""}`} onClick={()=>setTool("highlight")}>Gul merketusj</button>
      <button type="button" className="button" disabled={!count} onClick={()=>{strokesRef.current.pop();setCount(strokesRef.current.length);paint();}}>Angre</button>
      <button type="button" className="button" disabled={!count} onClick={()=>{strokesRef.current=[];setCount(0);paint();}}>Fjern markeringer</button>
    </div>
    <div className="image-marker-stage"><canvas ref={canvasRef} aria-label="Bilde som kan markeres" style={{touchAction:"none"}}
      onPointerDown={(event)=>{if(!ready)return;event.currentTarget.setPointerCapture(event.pointerId);activeRef.current={tool,points:[point(event)]};paint();}}
      onPointerMove={(event)=>{if(!activeRef.current)return;activeRef.current.points.push(point(event));paint();}}
      onPointerUp={end} onPointerCancel={end}/></div>
    {error&&<p className="feedback error" role="alert">{error}</p>}
    <div className="page-actions" style={{justifyContent:"flex-end"}}><button type="button" className="button" onClick={onCancel} disabled={busy}>Avbryt</button><button type="button" className="button primary" onClick={()=>void save()} disabled={!ready||busy}>{busy?"Lagrer …":"Lagre bilde"}</button></div>
  </section></div>;
}
