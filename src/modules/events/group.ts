import { daysUntil, toIstYmd } from "@/lib/dates";
import type { EventItem } from "./schema";

// The events page shows the itinerary a day at a time: one heading per date, the events of that day
// under it in time order, upcoming days first and finished days after, most recent first.
export type EventDay<E extends Pick<EventItem, "date" | "startTime"> = EventItem> = {
  ymd: string;
  date: Date;
  // 0 is today, negative is in the past.
  daysAway: number;
  events: E[];
};

export function groupEventsByDay<E extends Pick<EventItem, "date" | "startTime">>(
  events: E[],
  now: Date = new Date(),
): { upcoming: EventDay<E>[]; past: EventDay<E>[] } {
  const days = new Map<string, EventDay<E>>();
  for (const event of events) {
    const ymd = toIstYmd(event.date);
    const day = days.get(ymd) ?? {
      ymd,
      date: event.date,
      daysAway: daysUntil(event.date, now),
      events: [],
    };
    day.events.push(event);
    days.set(ymd, day);
  }
  const all = [...days.values()].sort((a, b) => a.ymd.localeCompare(b.ymd));
  for (const day of all) day.events.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return {
    upcoming: all.filter((d) => d.daysAway >= 0),
    past: all.filter((d) => d.daysAway < 0).reverse(),
  };
}

export function dayLabel(daysAway: number): string {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  if (daysAway > 1) return `In ${daysAway} days`;
  if (daysAway === -1) return "Yesterday";
  return `${-daysAway} days ago`;
}
