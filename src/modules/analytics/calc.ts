import { toIstYmd } from "@/lib/dates";

// Pure helpers for the charts, kept apart so they are easy to test. Weeks run Monday to Sunday in
// India time, and a chart never has more than MAX_WEEKS columns.

export const MAX_WEEKS = 104;
const DAY = 86_400_000;

const utcDay = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);
const ymdOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// The Monday (as YYYY-MM-DD) of the week a moment falls in, in India.
export function weekStart(date: Date): string {
  const day = utcDay(toIstYmd(date));
  const weekday = new Date(day).getUTCDay(); // 0 = Sunday
  return ymdOf(day - ((weekday + 6) % 7) * DAY);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function weekLabel(monday: string): string {
  const d = new Date(`${monday}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export type Dated = { date: Date; value: number };

// A running total by week: one column for every week from the first to the last (or the given
// range), so quiet weeks show as flat stretches, not gaps. Items before the range still count
// towards the total at its start only when `carryIn` is true (a "so far" line).
export function cumulativeByWeek(
  items: Dated[],
  range?: { from?: string; to?: string },
): { labels: string[]; values: number[]; truncated: boolean } {
  if (items.length === 0) return { labels: [], values: [], truncated: false };
  const starts = items.map((i) => weekStart(i.date)).sort();
  let first = range?.from ? weekStart(new Date(`${range.from}T00:00:00+05:30`)) : starts[0]!;
  let last = range?.to
    ? weekStart(new Date(`${range.to}T00:00:00+05:30`))
    : starts[starts.length - 1]!;
  if (first > last) [first, last] = [last, first];
  const weeks: string[] = [];
  for (let t = utcDay(first); t <= utcDay(last); t += 7 * DAY) weeks.push(ymdOf(t));
  const truncated = weeks.length > MAX_WEEKS;
  const shown = truncated ? weeks.slice(weeks.length - MAX_WEEKS) : weeks;
  const perWeek = new Map<string, number>();
  let before = 0;
  for (const item of items) {
    const w = weekStart(item.date);
    if (w < shown[0]!) before += item.value;
    else perWeek.set(w, (perWeek.get(w) ?? 0) + item.value);
  }
  let running = before;
  return {
    labels: shown.map(weekLabel),
    values: shown.map((w) => (running += perWeek.get(w) ?? 0)),
    truncated,
  };
}

// Whether a date (in India) falls inside the optional inclusive range.
export function inRange(date: Date, range: { from?: string; to?: string }): boolean {
  const day = toIstYmd(date);
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}
