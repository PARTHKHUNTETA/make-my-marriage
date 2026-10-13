import { describe, expect, it } from "vitest";
import { dayLabel, groupEventsByDay } from "./group";

const ev = (name: string, ymd: string, startTime: string) => ({
  name,
  date: new Date(`${ymd}T00:00:00+05:30`),
  startTime,
});
// 10 Oct 2026, midday in India
const NOW = new Date("2026-10-10T12:00:00+05:30");

describe("groupEventsByDay", () => {
  it("puts events of one date together, in time order, under one heading", () => {
    const { upcoming } = groupEventsByDay(
      [
        ev("Reception", "2026-10-14", "19:00"),
        ev("Wedding", "2026-10-14", "09:30"),
        ev("Mehndi", "2026-10-12", "16:00"),
      ],
      NOW,
    );
    expect(upcoming.map((d) => [d.ymd, d.events.map((e) => e.name)])).toEqual([
      ["2026-10-12", ["Mehndi"]],
      ["2026-10-14", ["Wedding", "Reception"]],
    ]);
    expect(upcoming.map((d) => d.daysAway)).toEqual([2, 4]);
  });

  it("keeps today in upcoming and puts finished days after, most recent first", () => {
    const { upcoming, past } = groupEventsByDay(
      [
        ev("Roka", "2026-10-01", "10:00"),
        ev("Engagement", "2026-10-09", "18:00"),
        ev("Haldi", "2026-10-10", "11:00"),
      ],
      NOW,
    );
    expect(upcoming.map((d) => d.events[0]!.name)).toEqual(["Haldi"]);
    expect(past.map((d) => d.events[0]!.name)).toEqual(["Engagement", "Roka"]);
  });

  it("handles no events", () => {
    expect(groupEventsByDay([], NOW)).toEqual({ upcoming: [], past: [] });
  });
});

describe("dayLabel", () => {
  it("reads naturally", () => {
    expect([0, 1, 5, -1, -4].map(dayLabel)).toEqual([
      "Today",
      "Tomorrow",
      "In 5 days",
      "Yesterday",
      "4 days ago",
    ]);
  });
});
