import { areas, type AreaKey } from "./scoring";

/** Shared numbers behind the store dashboard and the progress report, so both always agree. */
export type ProgressReport = { id: string; kind: "inspection" | "self_check"; date: string; total: number | null; areas: Partial<Record<AreaKey, number | null>> };
export type ProgressTask = { id: string; description: string; areaKey: string | null; status: string; dueDate: string | null; createdAt: string; updatedAt: string };
export type Period = "6m" | "12m" | "year";
export const periodLabels: Record<Period, string> = { "6m": "Siste 6 måneder", "12m": "Siste 12 måneder", year: "I år" };

const monthOf = (date: string) => date.slice(0, 7);
/** Months from the start of the period to the current month, as "yyyy-mm". */
export function periodMonths(period: Period, today: string): string[] {
  const [year, month] = today.split("-").map(Number);
  const count = period === "6m" ? 6 : period === "12m" ? 12 : month;
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1));
    return d.toISOString().slice(0, 7);
  });
}
const monthNames = ["jan.", "feb.", "mar.", "apr.", "mai", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "des."];
export const monthLabel = (month: string) => `${monthNames[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`;
const daysBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 86400000;

type Latest = { date: string; total: number; delta: number | null } | null;
function latestWithDelta(reports: ProgressReport[]): Latest {
  const scored = reports.filter((report) => report.total !== null).sort((a, b) => a.date.localeCompare(b.date));
  const last = scored.at(-1);
  if (!last) return null;
  const before = scored.at(-2);
  return { date: last.date, total: last.total!, delta: before ? last.total! - before.total! : null };
}

export function storeProgress(reports: ProgressReport[], tasks: ProgressTask[], period: Period, today: string) {
  const months = periodMonths(period, today), first = months[0], inPeriod = (date: string) => monthOf(date) >= first && monthOf(date) <= months.at(-1)!;
  const monthly = reports.filter((report) => report.kind === "self_check");
  const concept = reports.filter((report) => report.kind === "inspection");
  // Latest report of each kind per month; several in a month count as the last one.
  const lastIn = (list: ProgressReport[], month: string) => list.filter((report) => monthOf(report.date) === month).sort((a, b) => a.date.localeCompare(b.date)).at(-1) || null;
  const series = months.map((month) => {
    const review = lastIn(monthly, month), check = lastIn(concept, month);
    return {
      month, label: monthLabel(month),
      monthlyTotal: review?.total ?? null, conceptTotal: check?.total ?? null,
      areas: Object.fromEntries(areas.map((area) => [area.key, review?.areas[area.key] ?? null])) as Record<AreaKey, number | null>,
      created: tasks.filter((task) => monthOf(task.createdAt) === month).length,
      done: tasks.filter((task) => task.status === "done" && monthOf(task.updatedAt) === month).length,
    };
  });
  const periodMonthly = monthly.filter((report) => inPeriod(report.date) && report.total !== null).sort((a, b) => a.date.localeCompare(b.date));
  // Change per area across the period's monthly reviews: first scored value against the latest.
  const areaTrends = areas.map((area) => {
    const values = periodMonthly.map((report) => report.areas[area.key]).filter((value): value is number => value != null);
    return { key: area.key, label: area.label, latest: values.at(-1) ?? null, change: values.length > 1 ? values.at(-1)! - values[0] : null };
  });
  const done = tasks.filter((task) => task.status === "done");
  const doneInPeriod = done.filter((task) => inPeriod(task.updatedAt));
  const open = tasks.filter((task) => task.status !== "done").sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  return {
    months, series, areaTrends,
    latestConcept: latestWithDelta(concept), latestMonthly: latestWithDelta(monthly),
    monthsCovered: months.filter((month) => monthly.some((report) => monthOf(report.date) === month)).length,
    tasks: {
      created: tasks.filter((task) => inPeriod(task.createdAt)).length,
      done: doneInPeriod.length,
      open: open.length,
      overdue: open.filter((task) => task.dueDate && task.dueDate < today).length,
      averageDaysToDone: doneInPeriod.length ? doneInPeriod.reduce((sum, task) => sum + daysBetween(task.createdAt, task.updatedAt), 0) / doneInPeriod.length : null,
      openList: open,
    },
  };
}
export type StoreProgress = ReturnType<typeof storeProgress>;
