import { areas, validQuarters } from "./scoring";

export type EventAreaSnapshot = {
  key: string; score_quarters: number | null; comment: string;
  needs_follow_up: boolean; images: { path: string; caption: string }[];
};
export type EventSourceSnapshot = { areas: EventAreaSnapshot[] };
export type EventContribution = { name: string; snapshot: EventSourceSnapshot };

export function summarizeEvent(contributions: EventContribution[]) {
  const combinedAreas = areas.map((area) => {
    const submitted = contributions.flatMap((contribution) => contribution.snapshot.areas
      .filter((item) => item.key === area.key)
      .map((item) => ({ ...item, name: contribution.name })));
    const scores = submitted.map((item) => item.score_quarters).filter(validQuarters);
    return {
      key: area.key,
      score_quarters: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null,
      comment: submitted.filter((item) => item.comment.trim()).map((item) => `${item.name}: ${item.comment.trim()}`).join("\n\n"),
      needs_follow_up: submitted.some((item) => item.needs_follow_up),
      images: submitted.flatMap((item) => item.images.map((image) => ({
        path: image.path, caption: image.caption ? `${item.name}: ${image.caption}` : `Bilde fra ${item.name}`,
      }))),
    };
  });
  const covered = combinedAreas.filter((area) => area.score_quarters !== null).length;
  const total = covered === areas.length
    ? combinedAreas.reduce((sum, area) => sum + area.score_quarters!, 0) / (areas.length * 4)
    : null;
  return { areas: combinedAreas, covered, total };
}
