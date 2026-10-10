import { describe, expect, it } from "vitest";
import { periodMonths, storeProgress, type ProgressReport, type ProgressTask } from "./store-progress";

const report = (id: string, kind: ProgressReport["kind"], date: string, total: number, outdoor = total): ProgressReport =>
  ({ id, kind, date, total, areas: { outdoor, store: total, goods_receiving: total, drive_in: total } });
const task = (id: string, status: string, createdAt: string, updatedAt: string, dueDate: string | null = null): ProgressTask =>
  ({ id, description: id, areaKey: "outdoor", status, dueDate, createdAt, updatedAt });

describe("fremdrift per varehus", () => {
  it("lager måneder for perioden", () => {
    expect(periodMonths("6m", "2026-10-10")).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(periodMonths("year", "2026-03-01")).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(periodMonths("12m", "2026-01-15")[0]).toBe("2025-02");
  });
  it("regner endring, dekning og oppgaver", () => {
    const reports = [
      report("c1", "inspection", "2026-04-08", 9.1875), report("c2", "inspection", "2026-08-18", 9.625),
      report("m1", "self_check", "2026-06-02", 7, 6.5), report("m2", "self_check", "2026-07-03", 7.5, 7), report("m3", "self_check", "2026-09-01", 8, 8),
    ];
    const tasks = [
      task("a", "done", "2026-06-02T10:00:00Z", "2026-06-12T10:00:00Z"),
      task("b", "open", "2026-09-01T10:00:00Z", "2026-09-01T10:00:00Z", "2026-09-15"),
      task("c", "in_progress", "2026-09-20T10:00:00Z", "2026-09-25T10:00:00Z", "2026-11-01"),
    ];
    const result = storeProgress(reports, tasks, "6m", "2026-10-10");
    expect(result.latestConcept).toEqual({ date: "2026-08-18", total: 9.625, delta: 0.4375 });
    expect(result.latestMonthly?.delta).toBe(0.5);
    expect(result.monthsCovered).toBe(3);
    expect(result.areaTrends.find((area) => area.key === "outdoor")).toMatchObject({ latest: 8, change: 1.5 });
    expect(result.tasks).toMatchObject({ created: 3, done: 1, open: 2, overdue: 1, averageDaysToDone: 10 });
    expect(result.tasks.openList.map((item) => item.id)).toEqual(["b", "c"]);
    expect(result.series.find((month) => month.month === "2026-08")).toMatchObject({ conceptTotal: 9.625, monthlyTotal: null });
    expect(result.areaSource).toBe("monthly");
  });
  it("viser konseptsjekkene per område når perioden mangler månedlige gjennomganger", () => {
    const result = storeProgress([report("c1", "inspection", "2026-04-08", 9, 8), report("c2", "inspection", "2026-08-18", 9.5, 10)], [], "year", "2026-10-10");
    expect(result.areaSource).toBe("concept");
    expect(result.areaTrends.find((area) => area.key === "outdoor")).toMatchObject({ latest: 10, change: 2 });
  });
});
