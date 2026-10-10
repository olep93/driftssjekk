/** Walk order through the store, used everywhere: the app, the draft, the PDF and the deck. */
export const areas = [
  { key: "outdoor", label: "Uteområde" },
  { key: "store", label: "Butikk" },
  { key: "goods_receiving", label: "Varemottak" },
  { key: "drive_in", label: "Drive-In" },
] as const;

export type AreaKey = (typeof areas)[number]["key"];
export function validQuarters(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 4 && Number(value) <= 40;
}
export function quartersFromInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:[1-9](?:\.\d{1,2})?|10(?:\.0{1,2})?)$/.test(normalized)) return null;
  const quarter = Number(normalized) * 4;
  return validQuarters(quarter) ? quarter : null;
}
export function totalFromQuarters(values: number[]): number | null {
  return values.length === 4 && values.every(validQuarters)
    ? values.reduce((sum, value) => sum + value, 0) / 16
    : null;
}
export function averageFromQuarters(values: number[]): number | null {
  return values.length >= 1 && values.length <= 4 && values.every(validQuarters)
    ? values.reduce((sum, value) => sum + value, 0) / (values.length * 4)
    : null;
}
const scoreFormat = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function formatScore(value: number | null | undefined): string {
  return value == null ? "Ikke vurdert" : scoreFormat.format(value);
}
export function formatDate(value: string | null | undefined): string {
  if (!value) return "Ikke satt";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return "Ikke satt";
  return new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", day: "numeric", month: "short", year: "numeric" }).format(date);
}
