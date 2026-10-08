import { describe, expect, it } from "vitest";
import { summarizeEvent } from "./event-summary";

describe("samlet samlingsrapport", () => {
  it("kombinerer fordelte områder og snitter doble vurderinger likt", () => {
    const result = summarizeEvent([
      { name: "Tønsberg", snapshot: { areas: [
        { key: "drive_in", score_quarters: 24, comment: "God flyt", needs_follow_up: false, images: [] },
        { key: "store", score_quarters: 28, comment: "Ryddig", needs_follow_up: false, images: [] },
      ] } },
      { name: "Sandefjord", snapshot: { areas: [
        { key: "store", score_quarters: 32, comment: "Bra varetrykk", needs_follow_up: true, images: [] },
        { key: "outdoor", score_quarters: 20, comment: "", needs_follow_up: false, images: [] },
        { key: "goods_receiving", score_quarters: 36, comment: "", needs_follow_up: false, images: [] },
      ] } },
    ]);
    expect(result.covered).toBe(4);
    expect(result.areas.find((area) => area.key === "store")?.score_quarters).toBe(30);
    expect(result.areas.find((area) => area.key === "store")?.comment).toContain("Sandefjord: Bra varetrykk");
    expect(result.areas.find((area) => area.key === "store")?.needs_follow_up).toBe(true);
    expect(result.total).toBe(6.875);
  });
  it("viser ikke totalkarakter før alle fire områder er dekket", () => {
    const result = summarizeEvent([{ name: "Tønsberg", snapshot: { areas: [
      { key: "store", score_quarters: 24, comment: "", needs_follow_up: false, images: [] },
    ] } }]);
    expect(result.covered).toBe(1);
    expect(result.total).toBeNull();
  });
});
