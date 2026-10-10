import PptxGenJS from "pptxgenjs";
import { formatDate, formatScore } from "./scoring";
import { reportKindLabel } from "./report-kind";
import type { ProgressDocumentData } from "./report-template/progress-document";

/**
 * The progress report as an editable deck in the report template's style. Charts are drawn from
 * filled rectangles and text only: lines, rounded and transparent shapes break in phone previews.
 */
const c = { ink: "1D2836", muted: "647184", faint: "8B96A5", line: "E1E6EB", soft: "F3F5F7", accent: "2F6B86", good: "256D52", bad: "AC453D", flag: "9A5A12", flagSoft: "FBEFDF", badSoft: "F7E4E2", midSoft: "E7ECF1", mid: "33475C", white: "FFFFFF", concept: "8F9AA8", bar: "C9D3DD" };
const W = 13.333, H = 7.5, X = 0.7, CW = W - 2 * X, font = "Arial", display = "Arial Narrow";
const signed = (value: number | null) => value === null ? "" : Math.abs(value) < 0.005 ? "±0,00" : `${value > 0 ? "+" : "−"}${formatScore(Math.abs(value))}`;
const deltaColor = (value: number | null) => value === null || Math.abs(value) < 0.005 ? c.muted : value > 0 ? c.good : c.bad;

export async function buildProgressPptx(data: ProgressDocumentData): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; pptx.author = "Driftssjekk"; pptx.title = `${data.storeName} – fremdrift`;
  pptx.theme = { headFontFace: font, bodyFontFace: font };
  const { progress } = data, { tasks } = progress, slides: PptxGenJS.Slide[] = [];
  const block = (s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, color: string) => s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color }, line: { type: "none" } });
  const label = (s: PptxGenJS.Slide, text: string, x: number, y: number, w: number, color = c.muted) => s.addText(text.toUpperCase(), { x, y, w, h: 0.2, fontFace: font, fontSize: 8, color, charSpacing: 2.2, margin: 0 });
  const eyebrow = (s: PptxGenJS.Slide, text: string, y: number) => s.addText(text.toUpperCase(), { x: X, y, w: CW, h: 0.24, fontFace: font, fontSize: 9, color: c.accent, charSpacing: 2.5, margin: 0 });
  const title = (s: PptxGenJS.Slide, text: string, y: number, size = 30) => s.addText(text, { x: X, y, w: CW, h: 0.66, fontFace: display, fontSize: size, bold: true, color: c.ink, margin: 0, fit: "shrink", valign: "top" });
  function base() {
    const s = pptx.addSlide(); slides.push(s); s.background = { color: c.white };
    block(s, X, 0.335, 0.13, 0.13, c.accent);
    s.addText("DRIFTSSJEKK", { x: X + 0.2, y: 0.3, w: 4, h: 0.22, fontFace: display, fontSize: 10, bold: true, color: c.ink, charSpacing: 2, margin: 0 });
    s.addText("FREMDRIFTSRAPPORT", { x: W - X - 6, y: 0.3, w: 6, h: 0.22, fontFace: font, fontSize: 8.5, color: c.faint, charSpacing: 1, align: "right", margin: 0 });
    block(s, X, H - 0.48, CW, 0.012, c.line);
    s.addText(`${data.storeName} · ${data.periodLabel.toLowerCase()}`, { x: X, y: H - 0.4, w: 8, h: 0.2, fontFace: font, fontSize: 8, color: c.faint, margin: 0 });
    return s;
  }
  const range = `${progress.series[0].label} – ${progress.series.at(-1)!.label}`;

  // 1. Front: name and the four key figures.
  const front = base();
  eyebrow(front, `${data.cooperativeName} · Fremdriftsrapport`, 0.85);
  front.addText(data.storeName, { x: X, y: 1.12, w: CW, h: 0.95, fontFace: display, fontSize: 46, bold: true, color: c.ink, margin: 0, fit: "shrink", valign: "top" });
  front.addText(`${data.periodLabel} (${range}) · Laget ${formatDate(data.today)}`, { x: X, y: 2.05, w: CW, h: 0.28, fontFace: font, fontSize: 12, color: c.muted, margin: 0 });
  const kpis = [
    { label: "Siste konseptsjekk", value: progress.latestConcept ? formatScore(progress.latestConcept.total) : "—", hint: progress.latestConcept ? `${signed(progress.latestConcept.delta) || "Første"} · ${formatDate(progress.latestConcept.date)}` : "Ingen ennå", color: deltaColor(progress.latestConcept?.delta ?? null) },
    { label: "Siste driftsgjennomgang", value: progress.latestMonthly ? formatScore(progress.latestMonthly.total) : "—", hint: progress.latestMonthly ? `${signed(progress.latestMonthly.delta) || "Første"} · ${formatDate(progress.latestMonthly.date)}` : "Ingen ennå", color: deltaColor(progress.latestMonthly?.delta ?? null) },
    { label: "Måneder med gjennomgang", value: `${progress.monthsCovered} av ${progress.months.length}`, hint: "", color: c.muted },
    { label: "Oppgaver utført", value: `${tasks.done} av ${tasks.created}`, hint: `${tasks.open} åpne${tasks.overdue ? ` · ${tasks.overdue} forfalt` : ""}`, color: tasks.overdue ? c.bad : c.muted },
  ];
  const kw = (CW - 0.3 * 3) / 4;
  kpis.forEach((kpi, index) => {
    const x = X + index * (kw + 0.3), y = 2.85;
    block(front, x, y, kw, 2.3, c.soft);
    label(front, kpi.label, x + 0.25, y + 0.28, kw - 0.5);
    front.addText(kpi.value, { x: x + 0.22, y: y + 0.6, w: kw - 0.44, h: 0.95, fontFace: display, fontSize: kpi.value.length > 5 ? 36 : 48, bold: true, color: c.ink, margin: 0, valign: "top", fit: "shrink" });
    if (kpi.hint) front.addText(kpi.hint, { x: x + 0.25, y: y + 1.65, w: kw - 0.5, h: 0.3, fontFace: font, fontSize: 10.5, bold: true, color: kpi.color, margin: 0 });
    if (index === 2) {
      const sw = (kw - 0.5) / progress.series.length;
      progress.series.forEach((month, i) => block(front, x + 0.25 + i * sw, y + 1.72, sw - 0.03, 0.09, month.monthlyTotal !== null ? c.accent : "DFE5EA"));
    }
  });
  front.addText("Månedlige driftsgjennomganger er intern progresjon og teller ikke i konseptrangeringen.", { x: X, y: 5.5, w: CW, h: 0.3, fontFace: font, fontSize: 11, color: c.muted, margin: 0 });

  // 2. Development: monthly reviews as columns, concept checks as diamonds, concept line at 6.
  const dev = base();
  eyebrow(dev, "Utvikling", 0.85);
  title(dev, "Driftskarakter og konseptsjekker per måned", 1.1, 28);
  const values = progress.series.flatMap((month) => [month.monthlyTotal, month.conceptTotal]).filter((value): value is number => value !== null);
  const min = Math.min(4, Math.floor(Math.min(...values, 6) - 0.5));
  const chart = { x: X + 0.45, y: 2.1, w: CW - 0.45, h: 3.9 }, slot = chart.w / progress.series.length;
  const cy = (value: number) => chart.y + (10 - value) / (10 - min) * chart.h;
  for (let tick = min; tick <= 10; tick++) {
    if (tick % 2 && tick !== 6) continue;
    block(dev, chart.x, cy(tick), chart.w, tick === 6 ? 0.016 : 0.008, tick === 6 ? c.concept : c.line);
    dev.addText(String(tick), { x: X, y: cy(tick) - 0.11, w: 0.35, h: 0.22, fontFace: tick === 6 ? display : font, fontSize: tick === 6 ? 11 : 9, bold: tick === 6, color: tick === 6 ? c.ink : c.faint, align: "right", margin: 0 });
  }
  progress.series.forEach((month, index) => {
    const center = chart.x + index * slot + slot / 2, bw = Math.min(0.42, slot * 0.45);
    if (month.monthlyTotal !== null) {
      block(dev, center - bw / 2, cy(month.monthlyTotal), bw, chart.y + chart.h - cy(month.monthlyTotal), c.accent);
      dev.addText(formatScore(month.monthlyTotal), { x: center - 0.4, y: cy(month.monthlyTotal) - 0.28, w: 0.8, h: 0.24, fontFace: font, fontSize: 9.5, bold: true, color: c.ink, align: "center", margin: 0 });
    }
    if (month.conceptTotal !== null) {
      dev.addText("◆", { x: center - 0.2, y: cy(month.conceptTotal) - 0.2, w: 0.4, h: 0.4, fontFace: font, fontSize: 18, color: c.ink, align: "center", valign: "middle", margin: 0 });
      dev.addText(formatScore(month.conceptTotal), { x: center - 0.5, y: cy(month.conceptTotal) + 0.17, w: 1.0, h: 0.24, fontFace: display, fontSize: 12, bold: true, color: c.ink, align: "center", margin: 0 });
    }
    dev.addText(month.label, { x: center - slot / 2, y: chart.y + chart.h + 0.08, w: slot, h: 0.22, fontFace: font, fontSize: 9, color: c.muted, align: "center", margin: 0 });
  });
  block(dev, X, 6.55, 0.3, 0.1, c.accent);
  dev.addText("Månedlig driftsgjennomgang", { x: X + 0.38, y: 6.48, w: 2.6, h: 0.24, fontFace: font, fontSize: 10, color: c.muted, margin: 0 });
  dev.addText("◆  Uanmeldt konseptsjekk      ▬  Konsept (6)", { x: X + 3.1, y: 6.48, w: 6, h: 0.24, fontFace: font, fontSize: 10, color: c.muted, margin: 0 });

  // 3. Areas: first and latest score in the period, and the change.
  const areaSlide = base();
  eyebrow(areaSlide, `Områdene · ${progress.areaSource === "monthly" ? "driftsgjennomganger" : "konseptsjekker"}`, 0.85);
  title(areaSlide, "Utvikling per område i perioden", 1.1, 28);
  progress.areaTrends.forEach((area, index) => {
    const y = 2.15 + index * 0.95;
    const valuesForArea = progress.series.map((month) => (progress.areaSource === "monthly" ? month.areas : month.conceptAreas)[area.key]).filter((value): value is number => value !== null);
    areaSlide.addText(area.label, { x: X, y, w: 3, h: 0.5, fontFace: font, fontSize: 18, bold: true, color: c.ink, margin: 0, valign: "middle" });
    areaSlide.addText(valuesForArea.length ? valuesForArea.map(formatScore).join("  →  ") : "Ingen data", { x: X + 3.1, y, w: 5.3, h: 0.5, fontFace: font, fontSize: 12, color: c.muted, margin: 0, valign: "middle", fit: "shrink" });
    areaSlide.addText(formatScore(area.latest), { x: X + 8.6, y: y - 0.05, w: 1.6, h: 0.6, fontFace: display, fontSize: 30, bold: true, color: c.ink, align: "right", margin: 0, valign: "middle" });
    areaSlide.addText(area.change === null ? "—" : signed(area.change), { x: X + 10.4, y, w: 1.5, h: 0.5, fontFace: font, fontSize: 15, bold: true, color: deltaColor(area.change), align: "right", margin: 0, valign: "middle" });
    block(areaSlide, X, y + 0.72, CW, 0.01, c.line);
  });

  // 4. Tasks: given and done per month, then the open ones.
  const taskSlide = base();
  eyebrow(taskSlide, "Oppgaver", 0.85);
  title(taskSlide, `${tasks.done} av ${tasks.created} oppgaver utført i perioden`, 1.1, 28);
  const tc = { x: X, y: 2.0, w: 5.6, h: 2.6 }, tslot = tc.w / progress.series.length, tmax = Math.max(1, ...progress.series.flatMap((month) => [month.created, month.done]));
  block(taskSlide, tc.x, tc.y + tc.h, tc.w, 0.012, c.line);
  progress.series.forEach((month, index) => {
    const center = tc.x + index * tslot + tslot / 2, bw = Math.min(0.16, tslot / 3);
    if (month.created) block(taskSlide, center - bw - 0.01, tc.y + tc.h - month.created / tmax * tc.h, bw, month.created / tmax * tc.h, c.bar);
    if (month.done) block(taskSlide, center + 0.01, tc.y + tc.h - month.done / tmax * tc.h, bw, month.done / tmax * tc.h, c.good);
    taskSlide.addText(month.label.split(" ")[0], { x: center - tslot / 2, y: tc.y + tc.h + 0.06, w: tslot, h: 0.2, fontFace: font, fontSize: 7.5, color: c.muted, align: "center", margin: 0 });
  });
  block(taskSlide, X, 5.05, 0.14, 0.14, c.bar); taskSlide.addText("Gitt", { x: X + 0.2, y: 5.0, w: 1, h: 0.24, fontFace: font, fontSize: 10, color: c.muted, margin: 0 });
  block(taskSlide, X + 1.0, 5.05, 0.14, 0.14, c.good); taskSlide.addText("Utført", { x: X + 1.2, y: 5.0, w: 1, h: 0.24, fontFace: font, fontSize: 10, color: c.muted, margin: 0 });
  const listX = X + 6.2, listW = CW - 6.2;
  label(taskSlide, `Åpne oppgaver · ${tasks.open}`, listX, 2.0, listW);
  if (!tasks.openList.length) taskSlide.addText("Ingen åpne oppgaver.", { x: listX, y: 2.3, w: listW, h: 0.3, fontFace: font, fontSize: 12, color: c.muted, margin: 0 });
  tasks.openList.slice(0, 7).forEach((task, index) => {
    const y = 2.32 + index * 0.6, overdue = !!task.dueDate && task.dueDate < data.today;
    taskSlide.addText(task.description, { x: listX, y, w: listW - 1.5, h: 0.3, fontFace: font, fontSize: 12, bold: true, color: c.ink, margin: 0, fit: "shrink" });
    taskSlide.addText(task.dueDate ? `Frist ${formatDate(task.dueDate)}` : "Ingen frist", { x: listX, y: y + 0.28, w: listW - 1.5, h: 0.22, fontFace: font, fontSize: 9.5, color: c.muted, margin: 0 });
    taskSlide.addText(overdue ? "Forfalt" : task.status === "in_progress" ? "Under arbeid" : "Åpen", { x: listX + listW - 1.35, y: y + 0.05, w: 1.35, h: 0.28, fontFace: font, fontSize: 10, bold: true, color: overdue ? c.bad : task.status === "in_progress" ? c.flag : c.mid, fill: { color: overdue ? c.badSoft : task.status === "in_progress" ? c.flagSoft : c.midSoft }, align: "center", margin: 0 });
  });
  if (tasks.openList.length > 7) taskSlide.addText(`+ ${tasks.openList.length - 7} flere i appen`, { x: listX, y: 6.55, w: listW, h: 0.24, fontFace: font, fontSize: 10, color: c.muted, margin: 0 });

  // 5. Latest strengths and improvements, and the reports in the period.
  const inPeriod = data.history.filter((report) => report.date.slice(0, 7) >= progress.months[0]);
  if (data.highlights || inPeriod.length) {
    const last = base();
    eyebrow(last, "Status", 0.85);
    title(last, data.highlights ? "Siste styrker og forbedringer" : "Rapporter i perioden", 1.1, 28);
    let y = 2.0;
    if (data.highlights) {
      const boxes = [{ label: "Styrker", items: data.highlights.strengths, color: c.good }, { label: "Forbedringer", items: data.highlights.improvements, color: c.bad }].filter((box) => box.items.length);
      boxes.forEach((box, index) => {
        const w = boxes.length === 1 ? CW : (CW - 0.3) / 2, x = X + index * (w + 0.3);
        block(last, x, y, w, 1.7, c.soft);
        label(last, box.label, x + 0.3, y + 0.25, w - 0.6, box.color);
        last.addText(box.items.map((text) => ({ text, options: { bullet: { indent: 14 }, breakLine: true } })), { x: x + 0.3, y: y + 0.55, w: w - 0.6, h: 1.05, fontFace: font, fontSize: 13, color: c.ink, margin: 0, valign: "top", fit: "shrink", paraSpaceAfter: 4 });
      });
      last.addText(formatDate(data.highlights.date), { x: W - X - 3, y: 1.2, w: 3, h: 0.24, fontFace: font, fontSize: 10, color: c.muted, align: "right", margin: 0 });
      y += 2.1;
      if (inPeriod.length) label(last, "Rapporter i perioden", X, y, 4);
      y += 0.3;
    }
    inPeriod.slice(0, data.highlights ? 4 : 9).forEach((report) => {
      last.addText(formatDate(report.date), { x: X, y, w: 1.8, h: 0.34, fontFace: font, fontSize: 11, color: c.ink, margin: 0, valign: "middle" });
      last.addText(reportKindLabel(report.kind, report.eventId), { x: X + 1.9, y, w: 7, h: 0.34, fontFace: font, fontSize: 11, color: c.ink, margin: 0, valign: "middle" });
      last.addText(formatScore(report.total), { x: W - X - 1.5, y, w: 1.5, h: 0.34, fontFace: display, fontSize: 15, bold: true, color: c.ink, align: "right", margin: 0, valign: "middle" });
      block(last, X, y + 0.4, CW, 0.008, c.line);
      y += 0.47;
    });
  }

  slides.forEach((s, index) => s.addText(`${index + 1} / ${slides.length}`, { x: W - X - 1, y: H - 0.4, w: 1, h: 0.2, fontFace: font, fontSize: 8, color: c.faint, align: "right", margin: 0 }));
  const output = await pptx.write({ outputType: "nodebuffer" });
  return new Uint8Array(output as Uint8Array);
}
