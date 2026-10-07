"use client";

/* Local blob URLs are used only for the unsaved demo preview. */
/* eslint-disable @next/next/no-img-element */
import { ImagePlus, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";

export type DemoPhoto = { id: string; name: string; url: string; caption: string };

export function DemoAreaPhotos({
  areaLabel, photos, error, onAdd, onCaptionChange, onRemove,
}: {
  areaLabel: string;
  photos: DemoPhoto[];
  error: string;
  onAdd: (files: FileList | null) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onRemove: (id: string) => void;
}) {
  function choose(event: ChangeEvent<HTMLInputElement>) {
    onAdd(event.target.files);
    event.target.value = "";
  }

  return <div className="demo-photos">
    <div className="demo-photos-heading"><div><strong>Bilder</strong><span>Valgfritt · {photos.length} av 20</span></div></div>
    {photos.length > 0 && <div className="demo-photos-grid">{photos.map((photo) => <figure className="demo-photo-card" key={photo.id}>
      <a href={photo.url} target="_blank" rel="noreferrer" aria-label={`Åpne ${photo.name} i full størrelse`}><img src={photo.url} alt={photo.caption || `Forhåndsvisning av ${photo.name}`} /></a>
      <div className="demo-photo-details"><label>Bildetekst<input value={photo.caption} maxLength={1000} onChange={(event) => onCaptionChange(photo.id, event.target.value)} placeholder="Beskriv bildet" /></label><button type="button" onClick={() => onRemove(photo.id)}><Trash2 size={15} aria-hidden="true"/> Fjern bilde</button></div>
    </figure>)}</div>}
    <label className="demo-photo-add"><ImagePlus size={19} aria-hidden="true"/><span>Legg til bilder for {areaLabel}</span><small>Velg fra kamera eller bildebibliotek · JPEG, PNG eller WebP</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label={`Legg til bilder for ${areaLabel}`} onChange={choose} /></label>
    {error && <p className="feedback error demo-photo-error" role="alert">{error}</p>}
    <p className="demo-photo-note">Bildene vises bare i denne prøven og lastes ikke opp.</p>
  </div>;
}
