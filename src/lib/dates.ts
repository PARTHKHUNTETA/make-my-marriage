// Calendar dates are stored as instants but meant as dates in India (db-design §1: "interpreted
// in IST by the app"). IST has no daylight saving, so a fixed +05:30 offset is exact.
const IST_OFFSET_MINUTES = 330;
const IST = "Asia/Kolkata";

// "2026-02-14" -> the instant that is midnight on 14 February in India. Null if it is not a real date.
export function istDate(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const date = new Date(`${ymd}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return null;
  return toIstYmd(date) === ymd ? date : null; // rejects 2026-02-30 and similar
}

export function toIstYmd(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

// Whole calendar days from `now` to `date` in IST: positive before the date, 0 on it, negative after.
export function daysUntil(date: Date, now: Date = new Date()): number {
  const day = (d: Date) => Date.parse(`${toIstYmd(d)}T00:00:00Z`);
  return Math.round((day(date) - day(now)) / 86_400_000);
}

// "42 days to go" / "Tomorrow" / "Today" / "Married 12 days ago"
export function daysToGoLabel(days: number): string {
  if (days > 1) return `${days} days to go`;
  if (days === 1) return "Tomorrow";
  if (days === 0) return "Today";
  const ago = Math.abs(days);
  return `Married ${ago} ${ago === 1 ? "day" : "days"} ago`;
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: IST,
  }).format(date);
}

export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: IST,
  }).format(date);
}
