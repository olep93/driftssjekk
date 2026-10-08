"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TaskReplyForm({ actionId, currentStatus }: { actionId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pendingUpdateId, setPendingUpdateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      let updateId = pendingUpdateId;
      if (!updateId) {
        const response = await fetch(`/api/actions/${actionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, comment }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Kunne ikke lagre svaret");
        updateId = result.updateId;
      }
      if (file) {
        setPendingUpdateId(updateId);
        const image = new FormData(); image.set("image", file); image.set("caption", file.name); image.set("updateId", updateId);
        const response = await fetch(`/api/actions/${actionId}/images`, { method: "POST", body: image });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(`Svaret er lagret, men bildet mangler: ${result.error || "Prøv igjen."}`);
        }
      }
      setComment(""); setFile(null); setPendingUpdateId(""); router.refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Kunne ikke lagre svaret"); }
    finally { setBusy(false); }
  }

  return <form className="form-stack task-reply-form" onSubmit={submit}>
    <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)} disabled={Boolean(pendingUpdateId)}><option value="open">Åpen</option><option value="in_progress">Pågår</option><option value="done">Løst</option></select></label>
    <label>Svar<textarea value={comment} onChange={(event) => setComment(event.target.value)} minLength={1} maxLength={2000} required disabled={Boolean(pendingUpdateId)} placeholder="Hva har dere gjort, eller hva gjenstår?"/></label>
    <label>Bilde av løsningen (valgfritt)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)}/></label>
    <button className="button primary" disabled={busy || (Boolean(pendingUpdateId) && !file)}>{busy ? "Lagrer …" : pendingUpdateId ? "Prøv bildeopplastingen igjen" : "Lagre svar"}</button>
    {error && <p className="feedback error" role="alert">{error}</p>}
  </form>;
}
