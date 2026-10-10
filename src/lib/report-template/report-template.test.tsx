import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { balanceColumns, fitPhoto, peerComparison, photoLayout, summaryHeadline } from "./layout";
import { renderReportPdf } from "./render";
import type { ReportDocumentData, ReportPhoto } from "./report-document";
import { criteriaSections } from "../criteria";

async function photo(width: number, height: number, color: string, caption: string): Promise<ReportPhoto> {
  const data = await sharp({ create: { width, height, channels: 3, background: color } }).jpeg({ quality: 80 }).toBuffer();
  return { data, width, height, caption };
}

describe("bilderutenett", () => {
  it("bruker én, to eller tre kolonner etter antall bilder", () => {
    expect([1, 2, 4, 5, 20].map((count) => photoLayout(count).columns)).toEqual([1, 2, 2, 3, 3]);
  });
  it("holder bildene minst ca. 5 cm brede", () => {
    expect(photoLayout(20).cellWidth / 72 * 25.4).toBeGreaterThan(50);
  });
  it("tilpasser bildet i ruten uten å beskjære", () => {
    expect(fitPhoto(1200, 1600, 160, 120)).toEqual({ width: 90, height: 120 });
    expect(fitPhoto(1600, 900, 160, 120)).toEqual({ width: 160, height: 90 });
  });
});

describe("overskrift og sammenligning", () => {
  const scored = [{ label: "Drive-In", score: 6.75 }, { label: "Butikk", score: 7.25 }, { label: "Uteområde", score: 5.5 }, { label: "Varemottak", score: 6.25 }];
  it("sier konklusjonen", () => {
    expect(summaryHeadline("inspection", 6.4375, scored)).toBe("Over konsept, men uteområde trekker ned");
    expect(summaryHeadline("inspection", 5.5, scored.map((area) => ({ ...area, score: 5 })))).toBe("Under konsept i alle vurderte områder");
    expect(summaryHeadline("self_check", 6.4375, scored)).toBe("Butikk sterkest, uteområde svakest");
  });
  it("viser ikke sammenligning med for få varehus", () => {
    expect(peerComparison(6.4, [6, 6.2, 5.8])).toBeNull();
    expect(peerComparison(6.4, [6, 6.2, 5.8, 6.1])).toBe("above");
    expect(peerComparison(6.0, [6, 6.2, 5.8, 6.1])).toBe("level");
  });
  it("deler kriteriene i to omtrent like kolonner", () => {
    const [left, right] = balanceColumns(criteriaSections);
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
  });
});

describe("rapportmal", () => {
  it("lager en flersidig konseptsjekk med mange bilder", async () => {
    const colors = ["#7f97a9", "#b19c84", "#7c9486", "#a29cb3", "#9aa58a", "#b58f8b"];
    const many = await Promise.all(Array.from({ length: 18 }, (_, index) => index % 3 === 1
      ? photo(900, 1200, colors[index % colors.length], `Stående bilde ${index + 1}: reol ved inngang med tydelig prismerking`)
      : photo(1600, 1200, colors[index % colors.length], index % 4 === 0 ? `Bilde ${index + 1} – paller og tomemballasje ved porten mot varemottaket, som stenger deler av kjørebanen` : `Bilde ${index + 1}`)));
    const data: ReportDocumentData = {
      kind: "inspection", kindLabel: "Uanmeldt konseptsjekk", storeName: "Obs Bygg Tønsberg", cooperativeName: "Coop Sørøst", roundTitle: "Høstrunden 2026",
      visitDate: "2026-10-08", assessorName: "Kari Nordmann", versionNo: 1, total: 6.4375, partial: false,
      summary: "Varehuset fremstår ryddig og godt drevet, med tydelig kampanjegjennomføring i butikk. Uteområdet trekker ned på grunn av paller og avfall ved porten mot varemottaket. «Omtankesalg» ved kassene er godt gjennomført – særlig på Drive-In.",
      strengths: ["Ryddig og godt merket butikk", "Kampanjer satt opp etter plan", "Rask service i Drive-In"],
      improvements: ["Paller og avfall ved porten", "Falmet skilt mot hagesenteret", "Orden i varemottaket"],
      previousTotal: 6, peer: "above",
      history: [{ date: "2025-10-12", total: 5.4 }, { date: "2026-01-20", total: 5.75 }, { date: "2026-04-14", total: 5.9375 }, { date: "2026-07-02", total: 6 }, { date: "2026-10-08", total: 6.4375 }],
      areas: [
        { key: "drive_in", label: "Drive-In", score: 6.75, comment: "Ryddig og godt fylt. Reolene er merket, og kundene får rask hjelp.", needsFollowUp: false, photos: [await photo(1600, 1200, "#7f97a9", "Drive-In sett fra innkjøringen")] },
        { key: "store", label: "Butikk", score: 7.25, comment: "Kampanjeøya ved inngangen er satt opp etter plan. ".repeat(4), needsFollowUp: false, photos: await Promise.all([photo(1600, 1200, "#b19c84", "Kampanjeøya"), photo(900, 1200, "#7c9486", "Gavel med sesongvarer"), photo(1600, 1200, "#a29cb3", "Kasseområdet")]) },
        { key: "outdoor", label: "Uteområde", score: 5.5, comment: "Uteområdet er stort sett ryddig ved inngangen, men det står tomme paller og avfall ved porten mot varemottaket. Skiltingen til hagesenteret er falmet og vanskelig å se fra parkeringen. ".repeat(3), needsFollowUp: true, photos: many },
        { key: "goods_receiving", label: "Varemottak", score: 6.25, comment: "", needsFollowUp: false, photos: [] },
      ],
      tasks: [
        { area: "Uteområde", description: "Fjern paller og avfall ved porten mot varemottaket", dueDate: "2026-10-15", status: "in_progress", photo: many[0] },
        { area: "Uteområde", description: "Bytt skiltet mot hagesenteret", dueDate: null, status: "open", photo: null },
        { area: "Varemottak", description: "Merk opp soner i varemottaket", dueDate: "2026-10-22", status: "done", photo: many[1] },
      ],
    };
    const bytes = await renderReportPdf(data);
    if (process.env.PDF_VISUAL_QA === "1") { mkdirSync("tmp/pdfs", { recursive: true }); writeFileSync("tmp/pdfs/qa-ny-mal.pdf", bytes); }
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(8);
  }, 30000);
});
