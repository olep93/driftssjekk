import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFollowupPdf, sortTasks } from "./followup-pdf";

describe("oppfølgingsrapport", () => {
  it("sorterer oppgaver etter område og deretter alder", () => {
    const sorted = sortTasks([
      { areaKey: "outdoor", createdAt: "2026-10-09T10:00:00Z" },
      { areaKey: null, createdAt: "2026-10-01T10:00:00Z" },
      { areaKey: "drive_in", createdAt: "2026-10-09T12:00:00Z" },
      { areaKey: "drive_in", createdAt: "2026-10-09T08:00:00Z" },
    ]);
    expect(sorted.map((task) => `${task.areaKey}@${task.createdAt.slice(11, 13)}`)).toEqual(["drive_in@08", "drive_in@12", "outdoor@10", "null@10"]);
  });
  it("lager PDF med oppgaver, svar og bilder", async () => {
    const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#55758b" } }).jpeg().toBuffer();
    const storage = { storage: { from: () => ({ download: async (path: string) => path === "missing.jpg"
      ? { data: null, error: new Error("mangler") }
      : { data: new Blob([new Uint8Array(photo)], { type: "image/jpeg" }), error: null } }) } } as unknown as SupabaseClient;
    const bytes = await buildFollowupPdf({
      storeName: "Obs Bygg Tønsberg", cooperativeName: "Coop Sørøst", reportLabel: "Uanmeldt konseptsjekk", visitDate: "2026-10-08", generatedAt: "2026-10-09T12:00:00Z",
      tasks: [
        { areaKey: "store", description: "Rydd kampanjeøya ved inngangen. ".repeat(6), status: "in_progress", dueDate: "2026-10-20", createdAt: "2026-10-09T08:00:00Z", images: [{ path: "task.jpg", caption: "Før" }],
          updates: [{ author: "Kari", createdAt: "2026-10-09T11:00:00Z", status: "in_progress", comment: "Påbegynt, ferdig fredag.", images: [{ path: "reply.jpg", caption: "Underveis" }, { path: "missing.jpg", caption: "" }] }] },
        { areaKey: "outdoor", description: "Fjern paller ved varemottak", status: "open", dueDate: null, createdAt: "2026-10-09T09:00:00Z", images: [], updates: [] },
      ],
    }, storage);
    if (process.env.PDF_VISUAL_QA === "1") { mkdirSync("tmp/pdfs", { recursive: true }); writeFileSync("tmp/pdfs/qa-oppfolging.pdf", bytes); }
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
