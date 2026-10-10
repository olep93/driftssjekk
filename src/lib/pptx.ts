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
const W = 13.333, H = 7.5, X = 0.7, CW = W - 2 * X, font = "Arial";
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
    s.addText("DRIFTSSJEKK", { x: X, y: 0.3, w: 4, h: 0.22, fontFace: font, fontSize: 9, bold: true, color: c.ink, charSpacing: 2, margin: 0 });
    s.addText(label.toUpperCase(), { x: W - X - 6, y: 0.3, w: 6, h: 0.22, fontFace: font, fontSize: 8.5, color: c.faint, charSpacing: 1, align: "right", margin: 0 });
    block(s, X, H - 0.48, CW, 0.012, c.line);
    s.addText(`${snapshot.store_name} · ${date}`, { x: X, y: H - 0.4, w: 8, h: 0.2, fontFace: font, fontSize: 8, color: c.faint, margin: 0 });
    return s;
  }
  function eyebrow(s: PptxGenJS.Slide, text: string, y: number, x = X, w = CW) {
    s.addText(text.toUpperCase(), { x, y, w, h: 0.24, fontFace: font, fontSize: 10, bold: true, color: c.accent, charSpacing: 1.5, margin: 0 });
  }
  function title(s: PptxGenJS.Slide, text: string, y: number, x = X, w = CW, size = 30) {
    s.addText(text, { x, y, w, h: 0.62, fontFace: font, fontSize: size, bold: true, color: c.ink, margin: 0, fit: "shrink", valign: "top" });
  }
  function pill(s: PptxGenJS.Slide, text: string, x: number, y: number, colors: string[], w = 2.4) {
    s.addText(text, { x, y, w, h: 0.32, fontFace: font, fontSize: 11, bold: true, color: colors[0], fill: { color: colors[1] }, align: "center", margin: 0 });
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

  // 1. Title
  const cover = pptx.addSlide(); slides.push(cover); cover.background = { color: c.ink };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: H, fill: { color: c.accent }, line: { color: c.accent, width: 0 } });
  cover.addText("DRIFTSSJEKK", { x: X + 0.1, y: 0.55, w: 5, h: 0.26, fontFace: font, fontSize: 11, bold: true, color: "A9B6C6", charSpacing: 2, margin: 0 });
  cover.addText(kind.toUpperCase(), { x: X + 0.1, y: 2.0, w: 11, h: 0.3, fontFace: font, fontSize: 13, bold: true, color: "8FB8CC", charSpacing: 1.5, margin: 0 });
  cover.addText(snapshot.store_name, { x: X + 0.1, y: 2.4, w: 11.6, h: 0.95, fontFace: font, fontSize: 44, bold: true, color: c.white, margin: 0, fit: "shrink" });
  cover.addText([snapshot.cooperative_name, snapshot.round_title, date].filter(Boolean).join("  ·  "), { x: X + 0.1, y: 3.4, w: 11.6, h: 0.32, fontFace: font, fontSize: 15, color: "C3CEDA", margin: 0 });
  const coverScoreColor = selfCheck ? c.white : conceptBand(snapshot.total) === "above" ? "7FD1AB" : conceptBand(snapshot.total) === "below" ? "F0A39B" : c.white;
  cover.addText(formatScore(snapshot.total), { x: X + 0.1, y: 4.35, w: 3.6, h: 1.25, fontFace: font, fontSize: snapshot.total === null ? 28 : 72, bold: true, color: coverScoreColor, margin: 0 });
  const coverLines = [selfCheck ? "Driftskarakter · intern progresjon" : partial ? "Delvurdering av tildelte områder" : conceptLabel(snapshot.total)];
  if (!selfCheck && context?.previousTotal != null && snapshot.total !== null) {
    const delta = snapshot.total - context.previousTotal;
    coverLines.push(Math.abs(delta) < 0.005 ? "Samme som forrige konseptsjekk" : `${delta > 0 ? "+" : "−"}${formatScore(Math.abs(delta))} siden forrige konseptsjekk`);
  }
  if (!selfCheck && context?.peer) coverLines.push(context.peer === "above" ? "Over snittet i samvirkelaget" : context.peer === "below" ? "Under snittet i samvirkelaget" : "På snittet i samvirkelaget");
  cover.addText(coverLines.join("\n"), { x: X + 3.9, y: 4.55, w: 7.5, h: 1.0, fontFace: font, fontSize: 15, color: "C3CEDA", margin: 0, valign: "top", breakLine: false });
  cover.addText(`Vurdert av ${snapshot.assessor_name || "ukjent"}${snapshot.version_no > 1 ? ` · versjon ${snapshot.version_no}` : ""}`, { x: X + 0.1, y: H - 0.62, w: 10, h: 0.24, fontFace: font, fontSize: 10, color: "8E9BAC", margin: 0 });

  // 2. Summary: headline, total and the area bars
  const summary = base(kind);
  title(summary, summaryHeadline(snapshot.kind, snapshot.total, reportAreas.map((area) => ({ label: area.label, score: area.score }))), 0.75);
  summary.addText(selfCheck ? "DRIFTSKARAKTER" : partial ? "DELVURDERING" : "TOTALKARAKTER", { x: X, y: 1.75, w: 3.4, h: 0.24, fontFace: font, fontSize: 9.5, bold: true, color: c.muted, charSpacing: 1.2, margin: 0 });
  summary.addText(formatScore(snapshot.total), { x: X, y: 2.05, w: 3.4, h: 1.15, fontFace: font, fontSize: snapshot.total === null ? 24 : 66, bold: true, color: selfCheck ? c.ink : band(snapshot.total)[0], margin: 0 });
  if (!selfCheck) pill(summary, partial ? "Tildelte områder" : conceptLabel(snapshot.total), X, 3.3, band(snapshot.total));
  const rowsX = X + 4.1, rowsW = CW - 4.1, barX = rowsX + 2.2, barW = rowsW - 3.3;
  reportAreas.forEach((area, index) => {
    const y = 1.85 + index * 0.68, colors = selfCheck ? [c.accent, c.soft] : band(area.score);
    summary.addText(area.label, { x: rowsX, y, w: 2.1, h: 0.4, fontFace: font, fontSize: 15, bold: true, color: c.ink, margin: 0, valign: "middle" });
    block(summary, barX, y + 0.14, barW, 0.13, c.soft);
    // A score of 1 still shows a short stub, so the bar never looks missing.
    if (area.score !== null) block(summary, barX, y + 0.14, Math.max(0.1, barW * (area.score - 1) / 9), 0.13, colors[0]);
    if (!selfCheck) block(summary, barX + barW * 5 / 9 - 0.008, y + 0.04, 0.016, 0.33, "8F9AA8");
    summary.addText(formatScore(area.score), { x: rowsX + rowsW - 1.0, y, w: 1.0, h: 0.4, fontFace: font, fontSize: 19, bold: true, color: selfCheck ? c.ink : colors[0], align: "right", margin: 0, valign: "middle" });
    block(summary, rowsX, y + 0.55, rowsW, 0.01, c.line);
  });
  // Scale under the bars, with the concept grade highlighted.
  const scaleY = 1.85 + reportAreas.length * 0.68 - 0.05;
  for (let grade = 1; grade <= 10; grade++) {
    const concept = grade === 6 && !selfCheck;
    summary.addText(String(grade), { x: barX + barW * (grade - 1) / 9 - 0.2, y: scaleY, w: 0.4, h: 0.24, fontFace: font, fontSize: concept ? 11 : 9.5, bold: concept, color: concept ? c.ink : c.faint, align: "center", margin: 0 });
  }
  if (!selfCheck) summary.addText("konsept", { x: barX + barW * 5 / 9 - 0.5, y: scaleY + 0.22, w: 1.0, h: 0.2, fontFace: font, fontSize: 8.5, color: c.muted, align: "center", margin: 0 });
  const boxes = [{ label: "Styrker", items: context?.strengths || [], color: c.good }, { label: "Forbedringer", items: context?.improvements || [], color: c.bad }].filter((box) => box.items.length);
  boxes.forEach((box, index) => {
    const w = (CW - 0.3) / 2, x = X + index * (w + 0.3), y = 5.05;
    block(summary, x, y, w, 1.7, c.soft);
    summary.addText(box.label.toUpperCase(), { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.24, fontFace: font, fontSize: 10, bold: true, color: box.color, charSpacing: 1.2, margin: 0 });
    summary.addText(box.items.map((item) => ({ text: item, options: { bullet: { indent: 14 }, breakLine: true } })), { x: x + 0.25, y: y + 0.5, w: w - 0.5, h: 1.08, fontFace: font, fontSize: 14, color: c.ink, margin: 0, valign: "top", fit: "shrink", paraSpaceAfter: 4 });
  });
  if (snapshot.summary) summary.addNotes(clean(snapshot.summary));
  // A short summary fits under the areas when there are no highlight boxes; otherwise it gets its own slide.
  const inlineSummary = !boxes.length && clean(snapshot.summary).length > 0 && clean(snapshot.summary).length <= 320;
  if (inlineSummary) {
    eyebrow(summary, "Oppsummering", 5.1);
    summary.addText(clean(snapshot.summary), { x: X, y: 5.42, w: CW, h: 1.25, fontFace: font, fontSize: 16, color: c.ink, margin: 0, valign: "top", fit: "shrink" });
  }

  // 3. Summary text, split if long
  if (!inlineSummary && clean(snapshot.summary)) chunks(snapshot.summary, 900).forEach((part, index, all) => {
    const s = base(kind);
    eyebrow(s, index ? "Oppsummering (forts.)" : "Oppsummering", 0.8);
    s.addText(part, { x: X, y: 1.3, w: CW * 0.82, h: 5.3, fontFace: font, fontSize: all.length > 1 || part.length > 500 ? 17 : 21, color: c.ink, margin: 0, valign: "top", fit: "shrink", paraSpaceAfter: 6 });
  });

  // 4. One slide per area, extra slides for comment overflow and photos beyond the first four
  for (const [index, area] of reportAreas.entries()) {
    const photos = await Promise.all(area.item.images.map((image) => loadPhoto(supabase, "report-images", image.path, image.caption)));
    const s = base(kind), colors = selfCheck ? [c.ink, c.soft] : band(area.score), left = 4.55;
    eyebrow(s, `Område ${index + 1} av ${reportAreas.length}`, 0.8, X, left);
    title(s, area.label, 1.1, X, left, 32);
    s.addText(formatScore(area.score), { x: X, y: 1.85, w: 2.3, h: 0.95, fontFace: font, fontSize: area.score === null ? 22 : 54, bold: true, color: colors[0], margin: 0 });
    if (!selfCheck) pill(s, conceptLabel(area.score), X + 2.35, 2.2, colors, 2.0);
    let y = 3.0;
    if (area.item.needs_follow_up) { pill(s, "Krever oppfølging", X, y, [c.flag, c.flagSoft], 2.2); y += 0.5; }
    const comment = chunks(area.item.comment || "Ingen kommentar.", photos.length ? 520 : 1200);
    s.addText(comment[0], { x: X, y, w: photos.length ? left : CW * 0.82, h: H - 0.75 - y, fontFace: font, fontSize: 14, color: c.ink, margin: 0, valign: "top", fit: "shrink", paraSpaceAfter: 4 });
    if (area.item.comment) s.addNotes(clean(area.item.comment));
    const photoArea = { x: X + left + 0.35, y: 0.8, w: CW - left - 0.35, h: H - 0.8 - 0.75 };
    const first = photos.slice(0, 4), cells = photoCells(first.length, photoArea);
    first.forEach((image, photoIndex) => photo(s, image, cells[photoIndex], photoIndex + 1, area.item.images[photoIndex].caption));
    comment.slice(1).forEach((part) => {
      const more = base(kind);
      eyebrow(more, `${area.label} · vurdering (forts.)`, 0.8);
      more.addText(part, { x: X, y: 1.3, w: CW * 0.82, h: 5.3, fontFace: font, fontSize: 17, color: c.ink, margin: 0, valign: "top", fit: "shrink" });
    });
    for (let start = 4; start < photos.length; start += 6) {
      const more = base(kind), batch = photos.slice(start, start + 6);
      eyebrow(more, `${area.label} · bilder ${start + 1}–${start + batch.length} av ${photos.length}`, 0.8);
      const grid = photoCells(Math.max(batch.length, 5), { x: X, y: 1.25, w: CW, h: H - 1.25 - 0.75 });
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

  slides.forEach((s, index) => { if (index) s.addText(`${index + 1} / ${slides.length}`, { x: W - X - 1, y: H - 0.4, w: 1, h: 0.2, fontFace: font, fontSize: 8, color: c.faint, align: "right", margin: 0 }); });
  const output = await pptx.write({ outputType: "nodebuffer" });
  return new Uint8Array(output as Uint8Array);
}
