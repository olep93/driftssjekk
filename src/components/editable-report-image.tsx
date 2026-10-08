"use client";
/* Private signed image URLs are rendered directly to preserve access controls. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

export type EditableImageInfo = { id: string; area_key: string; caption: string; url: string; path: string };

export default function EditableReportImage({ image, areaLabel, onSaved, onEditImage, onRemove }: {
  image: EditableImageInfo;
  areaLabel: string;
  onSaved: (id: string, caption: string) => void;
  onEditImage: (image: EditableImageInfo) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(image.caption);
  const [expectedCaption, setExpectedCaption] = useState(image.caption);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function beginEditing() {
    setDraft(image.caption);
    setExpectedCaption(image.caption);
    setError("");
    setEditing(true);
  }

  async function saveCaption(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: draft, expectedCaption }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke lagre bildeteksten.");
      onSaved(image.id, result.caption);
      setEditing(false);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Kunne ikke kontakte serveren.");
    } finally {
      setBusy(false);
    }
  }

  return <article className="image-item">
    <a href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={image.caption || `Bilde fra ${areaLabel}`} /></a>
    {editing ? <form className="image-caption-form" onSubmit={saveCaption}>
      <label>Bildetekst<textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={3} autoFocus /></label>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <div className="image-item-actions">
        <button type="submit" className="button primary" disabled={busy}>{busy ? "Lagrer …" : "Lagre tekst"}</button>
        <button type="button" className="button" disabled={busy} onClick={() => setEditing(false)}>Avbryt</button>
      </div>
    </form> : <>
      <p className={image.caption ? "image-caption" : "image-caption muted"}>{image.caption || "Ingen bildetekst"}</p>
      <div className="image-item-actions">
        <button type="button" className="text-button" onClick={() => onEditImage(image)}>Rediger bilde</button>
        <button type="button" className="text-button" onClick={beginEditing}>{image.caption ? "Rediger tekst" : "Legg til tekst"}</button>
        <button type="button" className="text-button" onClick={() => onRemove(image.id)}>Fjern</button>
      </div>
    </>}
  </article>;
}
