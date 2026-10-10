"use client";
/* Private signed image URLs are rendered directly to preserve access controls. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardPlus } from "lucide-react";

type SourceImage = { id: string; caption: string; url: string };

export default function ReportTaskForm({ reportId, area, images }: { reportId: string; area: string; images: SourceImage[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sourceImageId, setSourceImageId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, area, description, assignee: null, dueDate: dueDate || null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke opprette oppgaven");
      setCreatedId(result.id);
      if (file || sourceImageId) {
        const image = new FormData();
        if (file) image.set("image", file);
        else image.set("sourceImageId", sourceImageId);
        image.set("caption", file ? file.name : images.find((item) => item.id === sourceImageId)?.caption || "Bilde fra rapporten");
        const imageResponse = await fetch(`/api/actions/${result.id}/images`, { method: "POST", body: image });
        if (!imageResponse.ok) {
          const imageResult = await imageResponse.json();
          throw new Error(`Oppgaven er opprettet, men bildet ble ikke lagt ved: ${imageResult.error || "Prøv igjen."}`);
        }
      }
      router.push(`/oppfolging/${result.id}`);
      router.refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Kunne ikke lagre oppgaven"); }
    finally { setBusy(false); }
  }

  return <div className="report-task no-print">
    <button type="button" className="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}><ClipboardPlus size={17}/> Gi oppgave til varehus</button>
    {open && <form className="form-stack report-task-form" onSubmit={submit}>
      <label>Hva skal varehuset gjøre?<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={3} maxLength={2000} required placeholder="Beskriv funnet og ønsket forbedring" /></label>
      <label>Frist (valgfritt)<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label>
      {images.length > 0 && <fieldset className="task-image-picker"><legend>Bruk bilde fra rapporten</legend><div className="task-image-grid">{images.map((item, index) => {
        const selected = sourceImageId === item.id;
        return <button type="button" key={item.id} className={selected ? "task-image-option selected" : "task-image-option"} aria-pressed={selected} aria-label={`${selected ? "Fjern valg av" : "Velg"} ${item.caption || `bilde ${index + 1}`}`}
          onClick={() => { setSourceImageId(selected ? "" : item.id); if (!selected) setFile(null); }}>
          {item.url ? <img src={item.url} alt="" /> : <span>Bilde {index + 1}</span>}
          {selected && <span className="task-image-check" aria-hidden="true"><Check size={15} strokeWidth={3}/></span>}
        </button>;
      })}</div></fieldset>}
      <label>{images.length > 0 ? "eller last opp bilde" : "Last opp bilde (valgfritt)"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.target.files?.[0] || null); if (event.target.files?.length) setSourceImageId(""); }}/></label>
      <div className="page-actions"><button className="button primary" disabled={busy}>{busy ? "Lagrer …" : "Send oppgave til varehus"}</button><button type="button" className="button" onClick={() => setOpen(false)}>Avbryt</button></div>
      {error && <p className="feedback error" role="alert">{error} {createdId && <a href={`/oppfolging/${createdId}`}>Åpne oppgaven</a>}</p>}
    </form>}
  </div>;
}
