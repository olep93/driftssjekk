import PptxGenJS from "pptxgenjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { areas, formatDate, formatScore } from "./scoring";
import { conceptBand, conceptLabel, criteriaSections } from "./criteria";
import { reportKindLabel } from "./report-kind";
import { balanceColumns, fitPhoto, summaryHeadline } from "./report-template/layout";
import { loadContext, loadPhoto, type ReportSnapshot } from "./report-template/build";
import type { ReportPhoto } from "./report-template/report-document";

/**
 * The deck follows the PDF template: same neutral colours, the same headline rules and the same
 * photo rules (never cropped, a fixed grid that grows into extra slides instead of shrinking).
 * PowerPoint cannot reliably embed fonts, so Arial stands in for the PDF's typefaces.
 */
const c = { ink: "1D2836", muted: "647184", faint: "8B96A5", line: "E1E6EB", soft: "F3F5F7", accent: "2F6B86", good: "256D52", goodSoft: "E2F0E9", bad: "AC453D", badSoft: "F7E4E2", mid: "33475C", midSoft: "E7ECF1", flag: "9A5A12", flagSoft: "FBEFDF", white: "FFFFFF" };
// Arial Narrow ships with Office and macOS; viewers without it fall back to Arial.
const W = 13.333, H = 7.5, X = 0.7, CW = W - 2 * X, font = "Arial", display = "Arial Narrow";
const band = (score: number | null) => { const value = conceptBand(score); return value === "above" ? [c.good, c.goodSoft] : value === "below" ? [c.bad, c.badSoft] : [c.mid, c.midSoft]; };
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim();
const clip = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
/** Splits long text at word boundaries so each slide keeps a readable amount. */
function chunks(value: string, max: number) {
  const words = clean(value).split(/\s+/).filter(Boolean), result: string[] = [];
  let current = "";
  for (const word of words) { if (current && `${current} ${word}`.length > max) { result.push(current); current = word; } else current = current ? `${current} ${word}` : word; }
  if (current) result.push(current);
  return result.length ? result : [""];
}

type Box = { x: number; y: number; w: number; h: number };
/** Photo cells for one slide: 1 large, 2 side by side, 3 as one large and two small, 4 as 2×2, 5–6 as 3×2. */
export function photoCells(count: number, area: Box): Box[] {
  const gap = 0.16, captionSpace = 0.34;
  const grid = (columns: number, rows: number) => Array.from({ length: count }, (_, index) => {
    const w = (area.w - gap * (columns - 1)) / columns, h = (area.h - gap * (rows - 1)) / rows;
    return { x: area.x + (index % columns) * (w + gap), y: area.y + Math.floor(index / columns) * (h + gap), w, h: h - captionSpace };
  });
  if (count <= 1) return [{ ...area, h: area.h - captionSpace }];
  if (count === 2) return grid(2, 1);
  if (count === 3) {
    const big = (area.w - gap) * 0.6, small = area.w - gap - big, half = (area.h - gap) / 2;
    return [{ x: area.x, y: area.y, w: big, h: area.h - captionSpace }, { x: area.x + big + gap, y: area.y, w: small, h: half - captionSpace }, { x: area.x + big + gap, y: area.y + half + gap, w: small, h: half - captionSpace }];
  }
  if (count === 4) return grid(2, 2);
  return grid(3, 2);
}

export async function buildReportPptx(snapshot: ReportSnapshot, supabase: SupabaseClient, versionId?: string): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; pptx.author = "Driftssjekk"; pptx.subject = "Rapport fra varehus";
  pptx.title = `${snapshot.store_name} – ${reportKindLabel(snapshot.kind)}`;
  pptx.theme = { headFontFace: font, bodyFontFace: font };
  const kind = reportKindLabel(snapshot.kind), selfCheck = snapshot.kind === "self_check";
  const context = versionId ? await loadContext(supabase, versionId, snapshot).catch(() => null) : null;
  const reportAreas = areas.filter((area) => snapshot.areas.some((item) => item.key === area.key)).map((area) => {
    const item = snapshot.areas.find((entry) => entry.key === area.key)!;
    return { ...area, item, score: item.score_quarters === null ? null : item.score_quarters / 4 };
  });
  const partial = snapshot.kind === "event_check" && reportAreas.length < 4;
  const date = formatDate(snapshot.visit_date);
  const slides: PptxGenJS.Slide[] = [];

  // Only filled rectangles: zero-height lines and rounded shapes render as broken boxes in some
  // viewers, such as the Quick Look preview on iPhone and Mac.
  // Transparency is avoided too: those viewers draw semi-transparent shapes as images, sometimes on other slides.
  function block(s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, color: string) {
    s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color }, line: { type: "none" } });
  }
  function base(label: string) {
    const s = pptx.addSlide(); slides.push(s); s.background = { color: c.white };
    block(s, X, 0.335, 0.13, 0.13, c.accent);
    s.addText("DRIFTSSJEKK", { x: X + 0.2, y: 0.3, w: 4, h: 0.22, fontFace: display, fontSize: 10, bold: true, color: c.ink, charSpacing: 2, margin: 0 });
    s.addText(label.toUpperCase(), { x: W - X - 6, y: 0.3, w: 6, h: 0.22, fontFace: font, fontSize: 8.5, color: c.faint, charSpacing: 1, align: "right", margin: 0 });
    block(s, X, H - 0.48, CW, 0.012, c.line);
    s.addText(`${snapshot.store_name} · ${date}`, { x: X, y: H - 0.4, w: 8, h: 0.2, fontFace: font, fontSize: 8, color: c.faint, margin: 0 });
    return s;
  }
  // Labels mirror the PDF's mono labels: small, spaced capitals.
  function eyebrow(s: PptxGenJS.Slide, text: string, y: number, x = X, w = CW) {
    s.addText(text.toUpperCase(), { x, y, w, h: 0.24, fontFace: font, fontSize: 9, color: c.accent, charSpacing: 2.5, margin: 0 });
  }
  function label(s: PptxGenJS.Slide, text: string, x: number, y: number, w: number, color = c.muted) {
    s.addText(text.toUpperCase(), { x, y, w, h: 0.2, fontFace: font, fontSize: 8, color, charSpacing: 2.2, margin: 0 });
  }
  function title(s: PptxGenJS.Slide, text: string, y: number, x = X, w = CW, size = 30) {
    s.addText(text, { x, y, w, h: 0.66, fontFace: display, fontSize: size + 2, bold: true, color: c.ink, margin: 0, fit: "shrink", valign: "top" });
  }
  function pill(s: PptxGenJS.Slide, text: string, x: number, y: number, colors: string[], w = 1.7) {
    s.addText(text, { x, y, w, h: 0.28, fontFace: font, fontSize: 10, bold: true, color: colors[0], fill: { color: colors[1] }, align: "center", margin: 0 });
  }
  /** The PDF's 1–10 scale: red to the concept line at 6, green after, with a marker at the score. */
  function scaleBar(s: PptxGenJS.Slide, x: number, y: number, w: number, score: number | null) {
    const at = (value: number) => x + w * (value - 1) / 9;
    block(s, x, y, at(6) - x, 0.09, "F0D6D2");
    block(s, at(6), y, x + w - at(6), 0.09, "D6E9DF");
    block(s, at(6) - 0.01, y - 0.05, 0.02, 0.19, c.ink);
    if (score !== null) s.addText("●", { x: at(score) - 0.15, y: y - 0.11, w: 0.3, h: 0.3, fontFace: font, fontSize: 15, color: c.ink, align: "center", valign: "middle", margin: 0 });
    s.addText("1", { x, y: y + 0.18, w: 0.4, h: 0.2, fontFace: font, fontSize: 8, color: c.muted, margin: 0 });
    s.addText("6 = konsept", { x: at(6) - 0.6, y: y + 0.18, w: 1.2, h: 0.2, fontFace: font, fontSize: 8, color: c.muted, align: "center", margin: 0 });
    s.addText("10", { x: x + w - 0.4, y: y + 0.18, w: 0.4, h: 0.2, fontFace: font, fontSize: 8, color: c.muted, align: "right", margin: 0 });
  }
  function photo(s: PptxGenJS.Slide, image: ReportPhoto | null, cell: Box, number: number, caption: string) {
    s.addShape(pptx.ShapeType.rect, { x: cell.x, y: cell.y, w: cell.w, h: cell.h, fill: { color: c.soft }, line: { color: c.soft, width: 0 } });
    if (image) {
      const fitted = fitPhoto(image.width, image.height, cell.w, cell.h);
      s.addImage({ data: `data:image/jpeg;base64,${image.data.toString("base64")}`, x: cell.x + (cell.w - fitted.width) / 2, y: cell.y + (cell.h - fitted.height) / 2, w: fitted.width, h: fitted.height, altText: caption || `Bilde ${number}` });
    } else s.addText("Bildet er tilgjengelig i appen", { x: cell.x, y: cell.y, w: cell.w, h: cell.h, fontFace: font, fontSize: 11, color: c.muted, align: "center", margin: 0 });
    s.addText(String(number), { x: cell.x + 0.1, y: cell.y + 0.1, w: 0.3, h: 0.24, fontFace: font, fontSize: 9, bold: true, color: c.ink, fill: { color: c.white }, align: "center", margin: 0 });
    if (caption) s.addText(clip(clean(caption), cell.w > 3 ? 140 : 80), { x: cell.x, y: cell.y + cell.h + 0.05, w: cell.w, h: 0.26, fontFace: font, fontSize: 9.5, color: c.muted, margin: 0, fit: "shrink", valign: "top" });
  }

  // 1. Front slide, laid out like the PDF's first page: name and result box on the left, the areas on the right.
  const front = base(kind);
  eyebrow(front, [snapshot.cooperative_name, snapshot.round_title].filter(Boolean).join(" · "), 0.8, X, 5.9);
  front.addText(snapshot.store_name, { x: X, y: 1.05, w: 5.9, h: 0.85, fontFace: display, fontSize: 40, bold: true, color: c.ink, margin: 0, fit: "shrink", valign: "top" });
  front.addText(`Besøk ${date} · Vurdert av ${snapshot.assessor_name || "ukjent"}${snapshot.version_no > 1 ? ` · Versjon ${snapshot.version_no}` : ""}`, { x: X, y: 1.9, w: 5.9, h: 0.26, fontFace: font, fontSize: 11, color: c.muted, margin: 0 });
  const box = { x: X, y: 2.5, w: 5.9, h: 2.75 };
  block(front, box.x, box.y, box.w, box.h, c.soft);
  label(front, selfCheck ? "Driftskarakter" : partial ? "Delvurdering" : "Totalkarakter", box.x + 0.3, box.y + 0.3, 2.6);
  front.addText(formatScore(snapshot.total), { x: box.x + 0.25, y: box.y + 0.6, w: 2.7, h: 1.45, fontFace: display, fontSize: snapshot.total === null ? 26 : 88, bold: true, color: selfCheck ? c.ink : band(snapshot.total)[0], margin: 0, valign: "top" });
  const side = box.x + 3.05, sideW = box.w - 3.05 - 0.3;
  if (selfCheck) pill(front, "Intern progresjon", side, box.y + 0.32, [c.mid, c.midSoft], 1.8);
  else pill(front, partial ? "Tildelte områder" : conceptLabel(snapshot.total), side, box.y + 0.32, band(snapshot.total));
  const comparisons: string[] = [];
  if (!selfCheck && context?.previousTotal != null && snapshot.total !== null) {
    const delta = snapshot.total - context.previousTotal;
    comparisons.push(Math.abs(delta) < 0.005 ? "Samme som forrige konseptsjekk" : `${delta > 0 ? "+" : "−"}${formatScore(Math.abs(delta))} siden forrige konseptsjekk`);
  }
  if (!selfCheck && context?.peer) comparisons.push(context.peer === "above" ? "Over snittet i samvirkelaget" : context.peer === "below" ? "Under snittet i samvirkelaget" : "På snittet i samvirkelaget");
  if (comparisons.length) front.addText(comparisons.join("\n"), { x: side, y: box.y + 0.75, w: sideW, h: 0.6, fontFace: font, fontSize: 10, color: c.ink, margin: 0, valign: "top", paraSpaceAfter: 2 });
  if (!selfCheck) scaleBar(front, side, box.y + 1.8, sideW, snapshot.total);
  const right = X + 6.35, rightW = CW - 6.35;
  front.addText(summaryHeadline(snapshot.kind, snapshot.total, reportAreas.map((area) => ({ label: area.label, score: area.score }))), { x: right, y: 0.8, w: rightW, h: 1.0, fontFace: display, fontSize: 24, bold: true, color: c.ink, margin: 0, valign: "top", fit: "shrink" });
  const barX = right + 1.55, barW = rightW - 1.55 - 0.95;
  reportAreas.forEach((area, index) => {
    const y = 2.5 + index * 0.66, colors = selfCheck ? [c.accent, c.soft] : band(area.score);
    front.addText(area.label, { x: right, y, w: 1.5, h: 0.4, fontFace: font, fontSize: 12.5, bold: true, color: c.ink, margin: 0, valign: "middle" });
    block(front, barX, y + 0.15, barW, 0.11, c.soft);
    // A score of 1 still shows a short stub, so the bar never looks missing.
    if (area.score !== null) block(front, barX, y + 0.15, Math.max(0.08, barW * (area.score - 1) / 9), 0.11, colors[0]);
    if (!selfCheck) block(front, barX + barW * 5 / 9 - 0.01, y + 0.06, 0.02, 0.29, c.ink);
    front.addText(formatScore(area.score), { x: right + rightW - 0.9, y, w: 0.9, h: 0.4, fontFace: display, fontSize: 19, bold: true, color: selfCheck ? c.ink : colors[0], align: "right", margin: 0, valign: "middle" });
    block(front, right, y + 0.54, rightW, 0.01, c.line);
  });
  const scaleY = 2.5 + reportAreas.length * 0.66 + 0.02;
  for (let grade = 1; grade <= 10; grade++) {
    const concept = grade === 6 && !selfCheck;
    front.addText(String(grade), { x: barX + barW * (grade - 1) / 9 - 0.2, y: scaleY, w: 0.4, h: 0.22, fontFace: concept ? display : font, fontSize: concept ? 11 : 8, bold: concept, color: concept ? c.ink : c.faint, align: "center", margin: 0 });
  }
  if (!selfCheck) front.addText("KONSEPT", { x: barX + barW * 5 / 9 - 0.5, y: scaleY + 0.21, w: 1.0, h: 0.18, fontFace: font, fontSize: 6.5, color: c.muted, charSpacing: 1.5, align: "center", margin: 0 });
  if (snapshot.summary) front.addNotes(clean(snapshot.summary));

  // 2. Strengths, improvements and the summary, like the lower half of the PDF's first page.
  const boxes = [{ label: "Styrker", items: context?.strengths || [], color: c.good }, { label: "Forbedringer", items: context?.improvements || [], color: c.bad }].filter((item) => item.items.length);
  // A short summary without highlight boxes sits under the result on the front slide, as in the PDF.
  const inlineSummary = !boxes.length && clean(snapshot.summary).length > 0 && clean(snapshot.summary).length <= 300;
  if (inlineSummary) {
    block(front, X, 5.62, CW, 0.01, c.line);
    label(front, "Oppsummering", X, 5.8, 4);
    front.addText(clean(snapshot.summary), { x: X, y: 6.08, w: CW, h: 0.75, fontFace: font, fontSize: 13, color: c.ink, margin: 0, valign: "top", fit: "shrink" });
  }
  const summaryParts = !inlineSummary && clean(snapshot.summary) ? chunks(snapshot.summary, boxes.length ? 650 : 1000) : [];
  if (boxes.length || summaryParts.length) {
    const s = base(kind);
    eyebrow(s, "Sammendrag", 0.8);
    title(s, boxes.length ? "Styrker og forbedringer" : "Oppsummering", 1.05);
    let y = 1.9;
    boxes.forEach((item, index) => {
      const w = boxes.length === 1 ? CW : (CW - 0.3) / 2, x = X + index * (w + 0.3);
      block(s, x, y, w, 1.85, c.soft);
      label(s, item.label, x + 0.3, y + 0.28, w - 0.6, item.color);
      s.addText(item.items.map((text) => ({ text, options: { bullet: { indent: 14 }, breakLine: true } })), { x: x + 0.3, y: y + 0.6, w: w - 0.6, h: 1.1, fontFace: font, fontSize: 14, color: c.ink, margin: 0, valign: "top", fit: "shrink", paraSpaceAfter: 5 });
    });
    if (boxes.length) y += 2.2;
    if (summaryParts.length) {
      if (boxes.length) label(s, "Oppsummering", X, y, 4);
      s.addText(summaryParts[0], { x: X, y: boxes.length ? y + 0.3 : y, w: CW * 0.86, h: H - 0.75 - (boxes.length ? y + 0.3 : y), fontFace: font, fontSize: boxes.length ? 14 : 17, color: c.ink, margin: 0, valign: "top", fit: "shrink", paraSpaceAfter: 5 });
    }
    summaryParts.slice(1).forEach((part) => {
      const more = base(kind);
      eyebrow(more, "Oppsummering (forts.)", 0.8);
      more.addText(part, { x: X, y: 1.3, w: CW * 0.86, h: 5.3, fontFace: font, fontSize: 17, color: c.ink, margin: 0, valign: "top", fit: "shrink", paraSpaceAfter: 5 });
    });
  }

  // 4. Each area in turn: a front slide with the score and assessment, then all of its photos,
  // before the next area starts. Up to four photos share one slide; larger sets use six per slide.
  for (const [index, area] of reportAreas.entries()) {
    const photos = await Promise.all(area.item.images.map((image) => loadPhoto(supabase, "report-images", image.path, image.caption)));
    // Like the PDF's area page: name on the left, score and verdict on the right, a rule, then the assessment.
    const s = base(kind), colors = selfCheck ? [c.ink, c.soft] : band(area.score);
    eyebrow(s, `Område ${index + 1} av ${reportAreas.length}`, 0.85, X, 7);
    s.addText(area.label, { x: X, y: 1.12, w: 8, h: 0.95, fontFace: display, fontSize: 46, bold: true, color: c.ink, margin: 0, valign: "top", fit: "shrink" });
    s.addText(formatScore(area.score), { x: W - X - 3.2, y: 0.7, w: 3.2, h: 1.2, fontFace: display, fontSize: area.score === null ? 24 : 70, bold: true, color: colors[0], align: "right", margin: 0, valign: "top" });
    if (!selfCheck) pill(s, conceptLabel(area.score), W - X - 1.7, 1.98, colors);
    block(s, X, 2.42, CW, 0.025, c.ink);
    label(s, "Vurdering", X, 2.7, 3);
    if (area.item.needs_follow_up) pill(s, "Krever oppfølging", W - X - 1.9, 2.62, [c.flag, c.flagSoft], 1.9);
    const comment = chunks(area.item.comment || "Ingen kommentar.", 900);
    s.addText(comment[0], { x: X, y: 3.02, w: CW * 0.86, h: H - 0.95 - 3.02, fontFace: font, fontSize: 16, color: c.ink, margin: 0, valign: "top", fit: "shrink", paraSpaceAfter: 4 });
    label(s, photos.length ? `Bilder · ${photos.length} på ${photos.length > 6 ? "de neste lysbildene" : "neste lysbilde"}` : "Ingen bilder fra området", X, H - 0.82, 8);
    if (area.item.comment) s.addNotes(clean(area.item.comment));
    comment.slice(1).forEach((part) => {
      const more = base(kind);
      eyebrow(more, `${area.label} · vurdering (forts.)`, 0.8);
      more.addText(part, { x: X, y: 1.3, w: CW * 0.86, h: 5.3, fontFace: font, fontSize: 17, color: c.ink, margin: 0, valign: "top", fit: "shrink" });
    });
    const perSlide = photos.length <= 4 ? 4 : 6;
    for (let start = 0; start < photos.length; start += perSlide) {
      const more = base(kind), batch = photos.slice(start, start + perSlide);
      eyebrow(more, photos.length === 1 ? `${area.label} · bilde` : `${area.label} · bilder ${start + 1}–${start + batch.length} av ${photos.length}`, 0.8);
      // A short last batch keeps the six-photo size so photos do not grow on the final slide.
      const grid = photoCells(perSlide === 6 ? Math.max(batch.length, 5) : batch.length, { x: X, y: 1.25, w: CW, h: H - 1.25 - 0.75 });
      batch.forEach((image, offset) => photo(more, image, grid[offset], start + offset + 1, area.item.images[start + offset].caption));
    }
  }

  // 5. Development over recent concept checks
  const history = context?.history || [];
  if (!selfCheck && history.length > 1) {
    const s = base(kind);
    eyebrow(s, "Utvikling", 0.8);
    title(s, "Konseptsjekker i varehuset", 1.1);
    const chart = { x: X, y: 2.1, w: CW, h: 3.9 }, slot = chart.w / history.length;
    block(s, chart.x, chart.y + chart.h, chart.w, 0.014, c.line);
    block(s, chart.x, chart.y + chart.h * 0.4, chart.w, 0.014, "8F9AA8");
    history.forEach((point, index) => {
      const h = chart.h * point.total / 10, x = chart.x + index * slot + slot * 0.2, w = slot * 0.6, current = index === history.length - 1;
      s.addShape(pptx.ShapeType.rect, { x, y: chart.y + chart.h - h, w, h, fill: { color: current ? c.accent : "C9D3DD" }, line: { color: current ? c.accent : "C9D3DD", width: 0 } });
      s.addText(formatScore(point.total), { x, y: chart.y + chart.h - h - 0.34, w, h: 0.28, fontFace: font, fontSize: 12, bold: current, color: current ? c.ink : c.muted, align: "center", margin: 0 });
      s.addText(formatDate(point.date), { x, y: chart.y + chart.h + 0.08, w, h: 0.26, fontFace: font, fontSize: 10, color: c.muted, align: "center", margin: 0 });
    });
    s.addText("Den tynne linjen viser konsept (karakter 6). Søylene starter på 0.", { x: X, y: chart.y + chart.h + 0.45, w: CW, h: 0.24, fontFace: font, fontSize: 10, color: c.muted, margin: 0 });
  }

  // 6. Criteria, two balanced columns per slide
  if (!selfCheck) {
    const [left, right] = balanceColumns(criteriaSections);
    const parts = [[left.slice(0, 1), left.slice(1)], [right.slice(0, Math.ceil(right.length / 2)), right.slice(Math.ceil(right.length / 2))]].map((columns) => columns.filter((column) => column.length));
    parts.forEach((columns, part) => {
      const s = base(kind);
      eyebrow(s, `Vedlegg · del ${part + 1} av ${parts.length}`, 0.8);
      title(s, "Vurderingskriterier", 1.05, X, CW, 26);
      s.addText("Skala 1–10. Karakter 6 er konsept. Under 6 er under konsept, over 6 er over konsept.", { x: X, y: 1.68, w: CW, h: 0.24, fontFace: font, fontSize: 11, color: c.muted, margin: 0 });
      columns.forEach((sections, column) => {
        const x = X + column * (CW / 2 + 0.15), w = CW / 2 - 0.15;
        const runs = sections.flatMap((section) => {
          const color = section.grade === "1–2" || section.grade === "3–5" ? c.bad : section.grade === "9" || section.grade === "10" ? c.good : c.mid;
          return [{ text: `Karakter ${section.grade}`, options: { bold: true, fontSize: 14, color, breakLine: true, paraSpaceBefore: 6 } }, ...section.points.map((point) => ({ text: point, options: { bullet: { indent: 12 }, fontSize: 10.5, color: c.ink, breakLine: true } }))];
        });
        s.addText(runs, { x, y: 2.1, w, h: H - 2.1 - 0.7, fontFace: font, margin: 0, valign: "top", fit: "shrink", paraSpaceAfter: 2 });
      });
    });
  }

  slides.forEach((s, index) => { s.addText(`${index + 1} / ${slides.length}`, { x: W - X - 1, y: H - 0.4, w: 1, h: 0.2, fontFace: font, fontSize: 8, color: c.faint, align: "right", margin: 0 }); });
  const output = await pptx.write({ outputType: "nodebuffer" });
  return new Uint8Array(output as Uint8Array);
}
