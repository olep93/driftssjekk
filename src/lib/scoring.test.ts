import { describe, expect, it } from "vitest";
import { averageFromQuarters, formatScore, quartersFromInput, totalFromQuarters } from "./scoring";

describe("karakterberegning", () => {
  it("godtar kun kvartsteg innenfor skalaen", () => {
    expect(quartersFromInput("1,00")).toBe(4);
    expect(quartersFromInput("10,00")).toBe(40);
    expect(quartersFromInput("0")).toBeNull();
    expect(quartersFromInput("10,25")).toBeNull();
    expect(quartersFromInput("8,30")).toBeNull();
  });
  it("bevarer eksakt total og runder bare visningen", () => {
    const total = totalFromQuarters([33, 34, 35, 31]);
    expect(total).toBe(8.3125);
    expect(formatScore(total)).toBe("8,31");
  });
  it("beregner karakter for bare de områdene en deltaker fikk", () => {
    expect(averageFromQuarters([24])).toBe(6);
    expect(averageFromQuarters([24, 28])).toBe(6.5);
    expect(averageFromQuarters([])).toBeNull();
  });
});
