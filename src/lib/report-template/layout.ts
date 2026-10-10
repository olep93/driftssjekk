import { conceptBand } from "../criteria";

/** A4 in PDF points, with the template's side margins. */
export const pageWidth = 595.28, pageHeight = 841.89, marginX = 46, contentWidth = pageWidth - 2 * marginX;
export const photoGap = 10;

export type PhotoLayout = { columns: 1 | 2 | 3; cellWidth: number; cellHeight: number };
/**
 * Picks a grid that keeps every photo large enough to read details: one photo gets the full width,
 * two to four share two columns, and five or more use three columns (about 50 mm wide), which is the
 * smallest size used. Long sets continue on the next page at the same size instead of shrinking.
 * Cells have a fixed 4:3 frame and photos are fitted inside it uncropped, so markings stay visible
 * and portrait and landscape photos line up.
 */
export function photoLayout(count: number): PhotoLayout {
  const columns = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const cellWidth = (contentWidth - photoGap * (columns - 1)) / columns;
  const cellHeight = columns === 1 ? 300 : cellWidth * 0.75;
  return { columns, cellWidth, cellHeight };
}

/** Size of a photo fitted inside a cell without cropping or enlarging beyond the cell. */
export function fitPhoto(width: number, height: number, cellWidth: number, cellHeight: number) {
  if (!width || !height) return { width: cellWidth, height: cellHeight };
  const scale = Math.min(cellWidth / width, cellHeight / height);
  return { width: width * scale, height: height * scale };
}

type AreaScore = { label: string; score: number | null };
/**
 * A heading that states the result instead of just naming the page, built from fixed phrases so the
 * wording is predictable. Concept checks are judged against the concept line at 6.
 */
export function summaryHeadline(kind: string, total: number | null, scored: AreaScore[]) {
  const rated = scored.filter((area): area is { label: string; score: number } => area.score !== null);
  if (total === null || !rated.length) return "Vurderingen er ikke fullført";
  const sorted = [...rated].sort((a, b) => a.score - b.score);
  const weakest = sorted[0], strongest = sorted[sorted.length - 1];
  if (kind === "self_check") {
    if (weakest.score === strongest.score) return "Jevnt nivå i alle områder";
    return `${strongest.label} sterkest, ${weakest.label.toLocaleLowerCase("nb-NO")} svakest`;
  }
  const band = conceptBand(total);
  const below = rated.filter((area) => conceptBand(area.score) === "below");
  const notBelow = rated.filter((area) => conceptBand(area.score) !== "below");
  if (band === "above") return below.length ? `Over konsept, men ${weakest.label.toLocaleLowerCase("nb-NO")} trekker ned` : rated.length === 4 ? "Over konsept i alle fire områder" : "Over konsept i alle vurderte områder";
  if (band === "concept") return below.length ? `På konsept, men ${weakest.label.toLocaleLowerCase("nb-NO")} ligger under` : "På konsept";
  return notBelow.length ? `Under konsept, men ${strongest.label.toLocaleLowerCase("nb-NO")} holder nivået` : "Under konsept i alle vurderte områder";
}

/** Below this many stores with a recent concept check, a peer comparison could reveal other stores. */
export const minimumPeerStores = 5;
export type PeerComparison = "above" | "level" | "below";
/** Compares with the cooperative average without exposing the average itself. */
export function peerComparison(total: number | null, peerTotals: number[]): PeerComparison | null {
  if (total === null || peerTotals.length < minimumPeerStores) return null;
  const average = peerTotals.reduce((sum, value) => sum + value, 0) / peerTotals.length;
  if (Math.abs(total - average) < 0.125) return "level";
  return total > average ? "above" : "below";
}

/** Splits criteria sections into two columns of roughly equal length, keeping each section whole. */
export function balanceColumns<T extends { points: readonly string[] }>(sections: readonly T[]): [T[], T[]] {
  const weight = (section: T) => 2 + section.points.reduce((sum, point) => sum + 1 + Math.floor(point.length / 60), 0);
  const total = sections.reduce((sum, section) => sum + weight(section), 0);
  const left: T[] = [], right: T[] = [];
  let used = 0;
  for (const section of sections) {
    if (right.length === 0 && used + weight(section) / 2 <= total / 2) { left.push(section); used += weight(section); }
    else right.push(section);
  }
  return [left, right];
}
