import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { areas, formatDate } from "./scoring";
import { printable, splitLines } from "./pdf";

export type FollowupImage = { path: string; caption: string };
export type FollowupUpdate = { author: string; createdAt: string; status: string | null; comment: string; images: FollowupImage[] };
export type FollowupTask = { areaKey: string | null; description: string; status: string; dueDate: string | null; createdAt: string; images: FollowupImage[]; updates: FollowupUpdate[] };
export type Followup = { storeName: string; cooperativeName: string; reportLabel: string; visitDate: string | null; generatedAt: string; tasks: FollowupTask[] };

const navy = rgb(.07,.15,.25), orange = rgb(.91,.46,.15), muted = rgb(.39,.45,.52), line = rgb(.86,.89,.91), green = rgb(.13,.42,.31), soft = rgb(.96,.97,.98);
export const statusLabels: Record<string,string> = { open: "Åpen", in_progress: "Under arbeid", done: "Utført" };
const statusColor = (status: string | null) => status === "done" ? green : status === "in_progress" ? orange : navy;
function stamp(value: string) {
  return new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
/** Orders tasks the way the report reads: by area, then oldest first. */
export function sortTasks<T extends { areaKey: string | null; createdAt: string }>(tasks: T[]) {
  const rank = (key: string | null) => { const index = areas.findIndex((area) => area.key === key); return index < 0 ? areas.length : index; };
  return [...tasks].sort((a, b) => rank(a.areaKey) - rank(b.areaKey) || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Builds a follow-up report for the tasks created from a published report. It is generated on
 * download, so it always shows current status, replies and photos; the published report itself stays locked.
 */
export async function buildFollowupPdf(data: Followup, storage: SupabaseClient): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28, height = 841.89, margin = 47, contentWidth = width - 2 * margin;
  let page: PDFPage = pdf.addPage([width, height]); let y = height - margin;
  function newPage() {
    page = pdf.addPage([width, height]); y = height - margin;
    page.drawRectangle({ x: 0, y: height - 10, width, height: 10, color: navy });
    page.drawRectangle({ x: 0, y: height - 10, width: 150, height: 10, color: orange });
    page.drawText(printable(`${data.storeName} · Oppfølging`).slice(0, 80), { x: margin, y, size: 9, font: bold, color: muted }); y -= 26;
  }
  function room(needed: number) { if (y - needed < margin + 26) newPage(); }
  function text(value: string, size = 10, font: PDFFont = regular, color = navy, space = 14, indent = 0) {
    for (const lineText of splitLines(value, font, size, contentWidth - indent)) { room(space); if (lineText) page.drawText(lineText, { x: margin + indent, y, size, font, color }); y -= space; }
  }
  async function photo(image: FollowupImage, indent = 0) {
    try {
      const { data: blob, error } = await storage.storage.from("action-images").download(image.path);
      if (error || !blob) throw error || new Error("Bilde mangler");
      const bytes = await sharp(Buffer.from(await blob.arrayBuffer())).rotate().jpeg({ quality: 85 }).toBuffer();
      const embedded = await pdf.embedJpg(bytes);
      const maxWidth = contentWidth - indent, maxHeight = embedded.height > embedded.width ? 300 : 230;
      const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height);
      const w = embedded.width * scale, h = embedded.height * scale;
      room(h + 24);
      page.drawRectangle({ x: margin + indent, y: y - h - 8, width: maxWidth, height: h + 16, color: soft });
      page.drawImage(embedded, { x: margin + indent + (maxWidth - w) / 2, y: y - h, width: w, height: h });
      y -= h + 20;
      if (image.caption) text(image.caption, 9, regular, muted, 13, indent);
      y -= 6;
    } catch { text("Bildet er tilgjengelig i appen.", 9, regular, muted, 14, indent); }
  }

  page.drawRectangle({ x: 0, y: height - 11, width, height: 11, color: navy });
  page.drawRectangle({ x: 0, y: height - 11, width: 170, height: 11, color: orange });
  text("OPPFØLGING", 10, bold, orange, 21);
  text(data.storeName, 24, bold, navy, 32);
  text(`${data.cooperativeName}  ·  ${data.reportLabel}${data.visitDate ? `  ·  Besøk ${formatDate(data.visitDate)}` : ""}`, 10, regular, muted, 19);
  text(`Status per ${stamp(data.generatedAt)}`, 10, regular, muted, 26);
  const counts = (["open", "in_progress", "done"] as const).map((status) => [status, data.tasks.filter((task) => task.status === status).length] as const);
  room(62); page.drawRectangle({ x: margin, y: y - 50, width: contentWidth, height: 56, color: soft });
  counts.forEach(([status, count], index) => {
    const x = margin + 18 + index * (contentWidth / 3);
    page.drawText(statusLabels[status].toUpperCase(), { x, y: y - 14, size: 8.5, font: bold, color: muted });
    page.drawText(String(count), { x, y: y - 40, size: 22, font: bold, color: statusColor(status) });
  });
  y -= 78;
  if (!data.tasks.length) text("Ingen oppgaver er opprettet fra denne rapporten.", 11, regular, muted, 16);

  for (const [index, task] of sortTasks(data.tasks).entries()) {
    room(120);
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: width - margin, y: y + 6 }, thickness: 1, color: line }); y -= 12;
    const area = areas.find((item) => item.key === task.areaKey)?.label || "Generelt";
    page.drawText(printable(`OPPGAVE ${index + 1}  ·  ${area.toUpperCase()}`), { x: margin, y, size: 9, font: bold, color: orange });
    const label = printable(statusLabels[task.status] || task.status);
    page.drawText(label, { x: width - margin - bold.widthOfTextAtSize(label, 10), y, size: 10, font: bold, color: statusColor(task.status) }); y -= 20;
    text(task.description, 12, bold, navy, 17);
    text(`Frist ${formatDate(task.dueDate)}  ·  Opprettet ${stamp(task.createdAt)}`, 9, regular, muted, 18);
    for (const image of task.images) await photo(image);
    if (!task.updates.length) { text("Ingen svar fra varehuset ennå.", 10, regular, muted, 20); continue; }
    room(40); text("SVAR OG FREMDRIFT", 9, bold, muted, 18);
    for (const update of task.updates) {
      room(50);
      page.drawRectangle({ x: margin, y: y - 4, width: 3, height: 14, color: statusColor(update.status) });
      text(`${update.author}  ·  ${stamp(update.createdAt)}${update.status ? `  ·  ${statusLabels[update.status] || update.status}` : ""}`, 9, bold, navy, 15, 12);
      if (update.comment) text(update.comment, 10, regular, navy, 14, 12);
      for (const image of update.images) await photo(image, 12);
      y -= 8;
    }
    y -= 14;
  }
  return pdf.save();
}
