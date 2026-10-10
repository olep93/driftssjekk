import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { renderToBuffer } from "@react-pdf/renderer";
import { storeProgress, type ProgressReport } from "../store-progress";
import { ProgressDocument, type ProgressDocumentData } from "./progress-document";
import { buildProgressPptx } from "../progress-pptx";

const r = (id: string, kind: ProgressReport["kind"], date: string, t: number, o: number, s: number, g: number, d: number): ProgressReport => ({ id, kind, date, total: t, areas: { outdoor: o, store: s, goods_receiving: g, drive_in: d } });
function sample(): ProgressDocumentData {
  const reports = [r("c1", "inspection", "2026-02-24", 9, 9, 8, 9.75, 9.25), r("c2", "inspection", "2026-04-08", 9.1875, 10, 8.75, 9, 9), r("c3", "inspection", "2026-08-18", 9.625, 10, 9.5, 9.5, 9.5),
    r("m1", "self_check", "2026-03-10", 7.5, 7, 8, 7.5, 7.5), r("m2", "self_check", "2026-05-12", 7.75, 7.5, 8, 8, 7.5), r("m3", "self_check", "2026-06-09", 8, 8, 8.25, 8, 7.75), r("m4", "self_check", "2026-09-08", 8.75, 9, 8.75, 8.5, 8.75), r("m5", "self_check", "2026-10-06", 9, 9.25, 9, 8.75, 9)];
  const tasks = [["a", "done", "2026-03-10", "2026-03-20"], ["b", "done", "2026-05-12", "2026-05-30"], ["c", "in_progress", "2026-09-08", "2026-09-20", "2026-10-01"], ["d", "open", "2026-10-06", "2026-10-06", "2026-10-30"]]
    .map(([id, status, created, updated, due]) => ({ id, description: `Oppgave ${id}: rydd paller ved porten`, areaKey: "outdoor", status, dueDate: due || null, createdAt: `${created}T10:00:00Z`, updatedAt: `${updated}T10:00:00Z` }));
  return { storeName: "Obs Bygg Tønsberg", cooperativeName: "Coop Sørøst", periodLabel: "Siste 12 måneder", generatedAt: "2026-10-10T12:00:00Z", today: "2026-10-10",
    progress: storeProgress(reports, tasks, "12m", "2026-10-10"),
    highlights: { date: "2026-10-06", strengths: ["Ryddig butikk", "God kampanjegjennomføring"], improvements: ["Paller ved porten"] },
    history: reports.map((report) => ({ kind: report.kind, eventId: null, date: report.date, total: report.total })).sort((a, b) => b.date.localeCompare(a.date)) };
}

describe("fremdriftsrapport", () => {
  it("lager PDF med utvikling, områder og oppgaver", async () => {
    const bytes = await renderToBuffer(<ProgressDocument data={sample()} />);
    if (process.env.PDF_VISUAL_QA === "1") { mkdirSync("tmp/pdfs", { recursive: true }); writeFileSync("tmp/pdfs/qa-fremdrift.pdf", bytes); }
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
  it("lager PowerPoint", async () => {
    const bytes = await buildProgressPptx(sample());
    if (process.env.PPTX_VISUAL_QA === "1") { mkdirSync("tmp/pptx", { recursive: true }); writeFileSync("tmp/pptx/qa-fremdrift.pptx", bytes); }
    expect(Buffer.from(bytes.subarray(0, 4)).toString("hex")).toBe("504b0304");
  });
});
