import PptxGenJS from "pptxgenjs";
import { conceptBand } from "./criteria";
import { areas, formatDate, formatScore } from "./scoring";
import type { RoundReportData } from "./round-report";
import { shortRound } from "./report-template/round-document";

/** The round report as an editable deck, drawn from filled rectangles and text like the other decks. */
const c = { ink: "1D2836", muted: "647184", faint: "8B96A5", line: "E1E6EB", soft: "F3F5F7", accent: "2F6B86", good: "256D52", bad: "AC453D", mid: "33475C", white: "FFFFFF", concept: "8F9AA8", bar: "C9D3DD" };
const W = 13.333, H = 7.5, X = 0.7, CW = W - 2 * X, font = "Arial", display = "Arial Narrow";
const signed = (value: number | null) => value === null ? "—" : Math.abs(value) < 0.005 ? "±0,00" : `${value > 0 ? "+" : "−"}${formatScore(Math.abs(value))}`;
const deltaColor = (value: number | null) => value === null || Math.abs(value) < 0.005 ? c.muted : value > 0 ? c.good : c.bad;
const band = (score: number | null) => { const value = conceptBand(score); return value === "above" ? c.good : value === "below" ? c.bad : c.mid; };
const short = (name: string) => name.replace(/^Obs Bygg /, "");

export async function buildRoundPptx(data: RoundReportData, today: string): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  const { summary } = data, { round } = summary;
  pptx.layout = "LAYOUT_WIDE"; pptx.author = "Driftssjekk"; pptx.title = `${round.title} – runderapport`;
  pptx.theme = { headFontFace: font, bodyFontFace: font };
  const slides: PptxGenJS.Slide[] = [];
  const block = (s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, color: string) => s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color }, line: { type: "none" } });
  const label = (s: PptxGenJS.Slide, text: string, x: number, y: number, w: number, color = c.muted, align: "left" | "right" = "left") => s.addText(text.toUpperCase(), { x, y, w, h: 0.2, fontFace: font, fontSize: 8, color, charSpacing: 2, align, margin: 0 });
  const eyebrow = (s: PptxGenJS.Slide, text: string, y = 0.85) => s.addText(text.toUpperCase(), { x: X, y, w: CW, h: 0.24, fontFace: font, fontSize: 9, color: c.accent, charSpacing: 2.5, margin: 0 });
  const title = (s: PptxGenJS.Slide, text: string, y = 1.1, size = 28) => s.addText(text, { x: X, y, w: CW, h: 0.66, fontFace: display, fontSize: size, bold: true, color: c.ink, margin: 0, fit: "shrink", valign: "top" });
  function base() {
    const s = pptx.addSlide(); slides.push(s); s.background = { color: c.white };
    block(s, X, 0.335, 0.13, 0.13, c.accent);
    s.addText("DRIFTSSJEKK", { x: X + 0.2, y: 0.3, w: 4, h: 0.22, fontFace: display, fontSize: 10, bold: true, color: c.ink, charSpacing: 2, margin: 0 });
    s.addText("RUNDERAPPORT", { x: W - X - 6, y: 0.3, w: 6, h: 0.22, fontFace: font, fontSize: 8.5, color: c.faint, charSpacing: 1, align: "right", margin: 0 });
    block(s, X, H - 0.48, CW, 0.012, c.line);
    s.addText(`${data.cooperativeName} · ${shortRound(round.title)}`, { x: X, y: H - 0.4, w: 8, h: 0.2, fontFace: font, fontSize: 8, color: c.faint, margin: 0 });
    return s;
  }
  const bar = (s: PptxGenJS.Slide, x: number, y: number, w: number, score: number | null) => {
    block(s, x, y, w, 0.11, c.soft);
    if (score !== null) block(s, x, y, Math.max(0.06, w * (score - 1) / 9), 0.11, band(score));
    block(s, x + w * 5 / 9 - 0.01, y - 0.06, 0.02, 0.23, c.ink);
  };

  // 1. Front with the key figures.
  const front = base();
  eyebrow(front, `${data.cooperativeName} · Konseptsjekkrunde`);
  front.addText(round.title, { x: X, y: 1.12, w: CW, h: 0.95, fontFace: display, fontSize: 46, bold: true, color: c.ink, margin: 0, fit: "shrink", valign: "top" });
  const dates = [round.from, round.to].filter(Boolean).map((date) => formatDate(date)).join(" – ");
  front.addText(`${dates ? `${dates} · ` : ""}${summary.completed} av ${summary.expected} varehus vurdert · Laget ${formatDate(today)}`, { x: X, y: 2.05, w: CW, h: 0.28, fontFace: font, fontSize: 12, color: c.muted, margin: 0 });
  const kpis = [
    { label: "Rundens snitt", value: formatScore(summary.roundAverage), hint: summary.previousTitle ? `${signed(summary.averageChange)} fra ${shortRound(summary.previousTitle)}` : "Første runde", color: deltaColor(summary.averageChange) },
    { label: "Gjennomført", value: `${summary.completed} av ${summary.expected}`, hint: `${summary.expected ? Math.round(summary.completed / summary.expected * 100) : 0} % dekning`, color: c.muted },
    { label: "Høyest vurdert", value: summary.best[0] ? formatScore(summary.best[0].total) : "—", hint: summary.best.map((entry) => short(entry.storeName)).join(" og "), color: c.ink },
    { label: "Svakeste område", value: summary.weakestArea ? formatScore(summary.weakestArea.average) : "—", hint: summary.weakestArea?.label || "", color: c.ink },
  ];
  const kw = (CW - 0.9) / 4;
  kpis.forEach((kpi, index) => {
    const x = X + index * (kw + 0.3), y = 2.85;
    block(front, x, y, kw, 2.3, c.soft);
    label(front, kpi.label, x + 0.25, y + 0.28, kw - 0.5);
    front.addText(kpi.value, { x: x + 0.22, y: y + 0.6, w: kw - 0.44, h: 0.95, fontFace: display, fontSize: kpi.value.length > 5 ? 36 : 48, bold: true, color: c.ink, margin: 0, valign: "top", fit: "shrink" });
    front.addText(kpi.hint, { x: x + 0.25, y: y + 1.65, w: kw - 0.5, h: 0.3, fontFace: font, fontSize: 10.5, bold: true, color: kpi.color, margin: 0, fit: "shrink" });
  });

  // 2. Ranking table.
  const rank = base();
  eyebrow(rank, "Rangering");
  title(rank, summary.best.length ? `${summary.best.map((entry) => short(entry.storeName)).join(" og ")} på topp med ${formatScore(summary.best[0].total)}` : "Rangering");
  const cols = { rank: X, store: X + 0.6, total: X + 4.0, area: X + 5.3, delta: X + 10.5 }, aw = 1.25;
  label(rank, "Plass", cols.rank, 2.05, 0.6); label(rank, "Varehus", cols.store, 2.05, 3); label(rank, "Total", cols.total, 2.05, 1.1, c.muted, "right");
  areas.forEach((area, index) => label(rank, area.label, cols.area + index * aw, 2.05, aw, c.muted, "right"));
  label(rank, "Endring", cols.delta, 2.05, 1.43, c.muted, "right");
  block(rank, X, 2.3, CW, 0.02, c.ink);
  summary.ranking.forEach((entry, index) => {
    const y = 2.42 + index * 0.62;
    rank.addText(String(entry.rank), { x: cols.rank, y, w: 0.5, h: 0.45, fontFace: display, fontSize: 18, bold: true, color: c.muted, margin: 0, valign: "middle" });
    rank.addText(entry.storeName, { x: cols.store, y, w: 3.3, h: 0.45, fontFace: font, fontSize: 14, bold: true, color: c.ink, margin: 0, valign: "middle" });
    rank.addText(formatScore(entry.total), { x: cols.total, y, w: 1.1, h: 0.45, fontFace: display, fontSize: 20, bold: true, color: band(entry.total), align: "right", margin: 0, valign: "middle" });
    areas.forEach((area, areaIndex) => rank.addText(formatScore(entry.areas[area.key]), { x: cols.area + areaIndex * aw, y, w: aw, h: 0.45, fontFace: font, fontSize: 12, color: band(entry.areas[area.key]), align: "right", margin: 0, valign: "middle" }));
    rank.addText(signed(entry.delta), { x: cols.delta, y, w: 1.43, h: 0.45, fontFace: font, fontSize: 12, bold: true, color: deltaColor(entry.delta), align: "right", margin: 0, valign: "middle" });
    block(rank, X, y + 0.54, CW, 0.008, c.line);
  });
  if (summary.previousTitle) rank.addText(`Endring er totalkarakter mot ${shortRound(summary.previousTitle)}. Grønt er over konsept, rødt under.`, { x: X, y: H - 0.85, w: CW, h: 0.24, fontFace: font, fontSize: 10, color: c.muted, margin: 0 });

  // 3. Areas across stores.
  const areaSlide = base();
  eyebrow(areaSlide, "Områdene på tvers");
  title(areaSlide, summary.weakestArea ? `${summary.weakestArea.label} er svakest i samvirkelaget` : "Områdene");
  summary.areaAverages.forEach((area, index) => {
    const y = 2.2 + index * 0.95;
    areaSlide.addText(area.label, { x: X, y, w: 2.3, h: 0.45, fontFace: font, fontSize: 16, bold: true, color: c.ink, margin: 0, valign: "middle" });
    bar(areaSlide, X + 2.4, y + 0.17, 4.4, area.average);
    areaSlide.addText(formatScore(area.average), { x: X + 7.0, y: y - 0.05, w: 1.3, h: 0.55, fontFace: display, fontSize: 26, bold: true, color: band(area.average), align: "right", margin: 0, valign: "middle" });
    areaSlide.addText(signed(area.change), { x: X + 8.4, y, w: 1.2, h: 0.45, fontFace: font, fontSize: 13, bold: true, color: deltaColor(area.change), align: "right", margin: 0, valign: "middle" });
    areaSlide.addText(area.weakest ? `Lavest: ${short(area.weakest.storeName)} ${formatScore(area.weakest.score)}` : "", { x: X + 9.8, y, w: CW - 9.8, h: 0.45, fontFace: font, fontSize: 11, color: c.muted, align: "right", margin: 0, valign: "middle" });
    block(areaSlide, X, y + 0.68, CW, 0.008, c.line);
  });

  // 4. Development over rounds.
  const dev = base();
  eyebrow(dev, "Utvikling");
  title(dev, "Rundens snitt over tid");
  const chart = { x: X, y: 2.0, w: 5.4, h: 3.6 }, slot = chart.w / summary.history.length;
  const scored = summary.history.map((item) => item.average).filter((value): value is number => value !== null);
  const min = Math.min(4, Math.floor(Math.min(...scored, 6) - 0.5)), cy = (value: number) => chart.y + (10 - value) / (10 - min) * chart.h;
  block(dev, chart.x, cy(6), chart.w, 0.016, c.concept);
  block(dev, chart.x, chart.y + chart.h, chart.w, 0.012, c.line);
  summary.history.forEach((item, index) => {
    const center = chart.x + index * slot + slot / 2, bw = Math.min(0.8, slot * 0.5), current = index === summary.history.length - 1;
    if (item.average !== null) {
      block(dev, center - bw / 2, cy(item.average), bw, chart.y + chart.h - cy(item.average), current ? c.accent : c.bar);
      dev.addText(formatScore(item.average), { x: center - 0.6, y: cy(item.average) - 0.32, w: 1.2, h: 0.28, fontFace: display, fontSize: current ? 15 : 12, bold: true, color: c.ink, align: "center", margin: 0 });
    }
    dev.addText(shortRound(item.title), { x: center - slot / 2, y: chart.y + chart.h + 0.08, w: slot, h: 0.24, fontFace: font, fontSize: 10, color: c.muted, align: "center", margin: 0 });
  });
  const tx = X + 6.0, tw = CW - 6.0, cw = (tw - 2.6) / summary.history.length;
  label(dev, "Varehus", tx, 2.0, 2.5);
  summary.history.forEach((item, index) => dev.addText(shortRound(item.title).toUpperCase(), { x: tx + 2.6 + index * cw, y: 2.0, w: cw, h: 0.2, fontFace: font, fontSize: 7, color: c.muted, charSpacing: 0.8, align: "right", margin: 0 }));
  block(dev, tx, 2.25, tw, 0.02, c.ink);
  summary.matrix.forEach((row, rowIndex) => {
    const y = 2.35 + rowIndex * 0.5;
    dev.addText(row.storeName, { x: tx, y, w: 2.5, h: 0.4, fontFace: font, fontSize: 12, bold: true, color: c.ink, margin: 0, valign: "middle", fit: "shrink" });
    row.totals.forEach((total, index) => dev.addText(formatScore(total), { x: tx + 2.6 + index * cw, y, w: cw, h: 0.4, fontFace: index === row.totals.length - 1 ? display : font, fontSize: index === row.totals.length - 1 ? 15 : 11, bold: index === row.totals.length - 1, color: band(total), align: "right", margin: 0, valign: "middle" }));
    block(dev, tx, y + 0.44, tw, 0.008, c.line);
  });

  // 5. One slide per store.
  for (const entry of summary.ranking) {
    const s = base();
    eyebrow(s, `Plass ${entry.rank} · Besøk ${formatDate(entry.date)}`);
    s.addText(entry.storeName, { x: X, y: 1.12, w: 8, h: 0.9, fontFace: display, fontSize: 40, bold: true, color: c.ink, margin: 0, valign: "top", fit: "shrink" });
    s.addText(formatScore(entry.total), { x: W - X - 3.2, y: 0.75, w: 3.2, h: 1.15, fontFace: display, fontSize: 66, bold: true, color: band(entry.total), align: "right", margin: 0, valign: "top" });
    s.addText(entry.delta === null ? "Ingen forrige runde" : `${signed(entry.delta)} fra forrige runde`, { x: W - X - 3.2, y: 1.95, w: 3.2, h: 0.26, fontFace: font, fontSize: 11, bold: true, color: deltaColor(entry.delta), align: "right", margin: 0 });
    block(s, X, 2.42, CW, 0.025, c.ink);
    const aw2 = (CW - 0.9) / 4;
    areas.forEach((area, index) => {
      const x = X + index * (aw2 + 0.3);
      s.addText(area.label, { x, y: 2.7, w: aw2 - 1, h: 0.3, fontFace: font, fontSize: 12, color: c.muted, margin: 0, valign: "middle" });
      s.addText(formatScore(entry.areas[area.key]), { x: x + aw2 - 1.1, y: 2.62, w: 1.1, h: 0.42, fontFace: display, fontSize: 20, bold: true, color: band(entry.areas[area.key]), align: "right", margin: 0, valign: "middle" });
      bar(s, x, 3.15, aw2, entry.areas[area.key]);
    });
    let y = 3.7;
    const boxes = [{ label: "Styrker", items: entry.strengths, color: c.good }, { label: "Forbedringer", items: entry.improvements, color: c.bad }].filter((box) => box.items.length);
    boxes.forEach((box, index) => {
      const w = boxes.length === 1 ? CW : (CW - 0.3) / 2, x = X + index * (w + 0.3);
      block(s, x, y, w, 1.55, c.soft);
      label(s, box.label, x + 0.3, y + 0.22, w - 0.6, box.color);
      s.addText(box.items.map((text) => ({ text, options: { bullet: { indent: 14 }, breakLine: true } })), { x: x + 0.3, y: y + 0.5, w: w - 0.6, h: 0.95, fontFace: font, fontSize: 12.5, color: c.ink, margin: 0, valign: "top", fit: "shrink", paraSpaceAfter: 3 });
    });
    if (boxes.length) y += 1.8;
    const text = entry.summary && !entry.summary.startsWith("Historisk import") ? entry.summary : "";
    if (text) s.addText(text, { x: X, y, w: CW * 0.9, h: H - 0.75 - y, fontFace: font, fontSize: 13, color: c.ink, margin: 0, valign: "top", fit: "shrink" });
    if (text) s.addNotes(text);
  }

  // 6. Open tasks from the round.
  if (data.openTasks.length) {
    const s = base();
    eyebrow(s, "Oppfølging");
    title(s, `${data.openTasks.length} åpne tiltak fra runden`);
    data.openTasks.slice(0, 9).forEach((task, index) => {
      const y = 2.0 + index * 0.52;
      s.addText(short(task.storeName), { x: X, y, w: 2.2, h: 0.4, fontFace: font, fontSize: 12, bold: true, color: c.ink, margin: 0, valign: "middle" });
      s.addText(task.description, { x: X + 2.3, y, w: CW - 2.3 - 2.2, h: 0.4, fontFace: font, fontSize: 12, color: c.ink, margin: 0, valign: "middle", fit: "shrink" });
      s.addText(task.due_date ? `Frist ${formatDate(task.due_date)}` : "Ingen frist", { x: W - X - 2.1, y, w: 2.1, h: 0.4, fontFace: font, fontSize: 11, color: task.due_date && task.due_date < today ? c.bad : c.muted, align: "right", margin: 0, valign: "middle" });
      block(s, X, y + 0.46, CW, 0.008, c.line);
    });
  }

  slides.forEach((s, index) => s.addText(`${index + 1} / ${slides.length}`, { x: W - X - 1, y: H - 0.4, w: 1, h: 0.2, fontFace: font, fontSize: 8, color: c.faint, align: "right", margin: 0 }));
  const output = await pptx.write({ outputType: "nodebuffer" });
  return new Uint8Array(output as Uint8Array);
}
