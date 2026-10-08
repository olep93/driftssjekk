import { areas, type AreaKey } from "./scoring";

export type DraftFields = {
  visitDate: string;
  summary: string;
  areas: Record<AreaKey, { score_quarters: number | null; comment: string; needs_follow_up: boolean }>;
};

export function mergeDraft(base: DraftFields, mine: DraftFields, theirs: DraftFields, prefer: "mine" | "theirs" = "mine") {
  const conflicts: string[] = [];
  function value<T>(label: string, old: T, local: T, remote: T): T {
    if (local === old) return remote;
    if (remote === old || remote === local) return local;
    conflicts.push(label);
    return prefer === "mine" ? local : remote;
  }
  const merged: DraftFields = {
    visitDate: value("Besøksdato", base.visitDate, mine.visitDate, theirs.visitDate),
    summary: value("Oppsummering", base.summary, mine.summary, theirs.summary),
    areas: {} as DraftFields["areas"],
  };
  for (const area of areas) {
    const key = area.key;
    merged.areas[key] = {
      score_quarters: value(`${area.label}: karakter`, base.areas[key].score_quarters, mine.areas[key].score_quarters, theirs.areas[key].score_quarters),
      comment: value(`${area.label}: kommentar`, base.areas[key].comment, mine.areas[key].comment, theirs.areas[key].comment),
      needs_follow_up: value(`${area.label}: oppfølging`, base.areas[key].needs_follow_up, mine.areas[key].needs_follow_up, theirs.areas[key].needs_follow_up),
    };
  }
  return { merged, conflicts };
}
