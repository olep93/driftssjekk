import { describe, expect, it } from "vitest";
import { summarizeRound, type RoundEntry, type RoundInfo } from "./round-report";

const entry = (storeName: string, o: number, s: number, d: number, g: number): RoundEntry =>
  ({ storeId: storeName, storeName, reportId: `r-${storeName}`, date: "2026-08-18", total: (o + s + d + g) / 4, areas: { outdoor: o, store: s, drive_in: d, goods_receiving: g }, strengths: [], improvements: [], summary: "" });
const round = (sequence: number, title: string): RoundInfo => ({ id: title, title, sequence, from: null, to: null, status: "closed" });

describe("runderapport", () => {
  // Coop Sørøst, April and August 2026 (Uteområde, Butikk, Drive-In, Varemottak).
  const april = [entry("Skien", 7.5, 8.75, 7, 9), entry("Tønsberg", 10, 8.75, 9, 9), entry("Sandefjord", 8.75, 8.75, 9, 9), entry("Mjøndalen", 9.5, 8.25, 9.25, 10), entry("Kongsberg", 8.25, 5.5, 7.75, 7.5)];
  const august = [entry("Skien", 9.25, 8.75, 6.5, 7.25), entry("Tønsberg", 10, 9.5, 9.5, 9.5), entry("Sandefjord", 9.75, 9.5, 9.5, 9.75), entry("Mjøndalen", 8.75, 8.25, 9.25, 9.5), entry("Kongsberg", 8, 8.5, 8, 7.25)];
  const result = summarizeRound(round(3, "August"), august, 5, [{ round: round(2, "April"), entries: april }]);
  it("rangerer med delt plass og endring fra forrige runde", () => {
    expect(result.ranking.map((row) => `${row.rank} ${row.storeName}`)).toEqual(["1 Sandefjord", "1 Tønsberg", "3 Mjøndalen", "4 Kongsberg", "4 Skien"]);
    expect(result.ranking.find((row) => row.storeName === "Tønsberg")?.delta).toBeCloseTo(0.4375);
    expect(result.roundAverage).toBeCloseTo(8.8125);
    expect(result.averageChange).toBeCloseTo(8.8125 - 8.525);
  });
  it("finner svakeste område og varehus per område", () => {
    expect(result.weakestArea?.label).toBe("Drive-In");
    expect(result.weakestArea?.average).toBeCloseTo(8.55);
    expect(result.areaAverages.find((area) => area.key === "drive_in")?.weakest).toEqual({ storeName: "Skien", score: 6.5 });
    expect(result.matrix[0].totals).toHaveLength(2);
  });
});

import { mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { RoundDocument } from "./report-template/round-document";
import { buildRoundPptx } from "./round-pptx";

describe("runderapport som filer", () => {
  const e = (storeName: string, o: number, s: number, d: number, g: number, strengths: string[] = []): RoundEntry =>
    ({ storeId: storeName, storeName: `Obs Bygg ${storeName}`, reportId: `r-${storeName}`, date: "2026-08-18", total: (o + s + d + g) / 4, areas: { outdoor: o, store: s, drive_in: d, goods_receiving: g }, strengths, improvements: strengths.length ? ["Paller ved porten"] : [], summary: strengths.length ? "Ryddig varehus med god kampanjegjennomføring." : "" });
  const feb = [e("Skien", 10, 9, 8, 9), e("Tønsberg", 9, 8, 9.25, 9.75), e("Sandefjord", 10, 9.5, 9.75, 9.75), e("Mjøndalen", 10, 9.25, 9.25, 9.75), e("Kongsberg", 9.5, 7.25, 8, 8.5)];
  const apr = [e("Skien", 7.5, 8.75, 7, 9), e("Tønsberg", 10, 8.75, 9, 9), e("Sandefjord", 8.75, 8.75, 9, 9), e("Mjøndalen", 9.5, 8.25, 9.25, 10), e("Kongsberg", 8.25, 5.5, 7.75, 7.5)];
  const aug = [e("Skien", 9.25, 8.75, 6.5, 7.25), e("Tønsberg", 10, 9.5, 9.5, 9.5, ["Ryddig butikk", "Sterk Drive-In"]), e("Sandefjord", 9.75, 9.5, 9.5, 9.75), e("Mjøndalen", 8.75, 8.25, 9.25, 9.5), e("Kongsberg", 8, 8.5, 8, 7.25)];
  const data = { cooperativeId: "c", cooperativeName: "Coop Sørøst", openTasks: [{ id: "t", report_id: "r-Skien", description: "Rydd Drive-In", status: "open", due_date: "2026-09-01", area_key: "drive_in", storeName: "Obs Bygg Skien" }],
    summary: summarizeRound({ ...round(3, "Konseptsjekk august 2026"), from: "2026-08-18", to: "2026-08-19" }, aug, 5, [{ round: round(1, "Konseptsjekk februar 2026"), entries: feb }, { round: round(2, "Konseptsjekk april 2026"), entries: apr }]) };
  it("lager PDF og PowerPoint", async () => {
    const pdf = await renderToBuffer(createElement(RoundDocument, { data, today: "2026-10-11" }) as Parameters<typeof renderToBuffer>[0]);
    const deck = await buildRoundPptx(data, "2026-10-11");
    if (process.env.PDF_VISUAL_QA === "1") { mkdirSync("tmp/pdfs", { recursive: true }); writeFileSync("tmp/pdfs/qa-runde.pdf", pdf); }
    if (process.env.PPTX_VISUAL_QA === "1") { mkdirSync("tmp/pptx", { recursive: true }); writeFileSync("tmp/pptx/qa-runde.pptx", deck); }
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThanOrEqual(3);
    expect(Buffer.from(deck.subarray(0, 4)).toString("hex")).toBe("504b0304");
  });
});
