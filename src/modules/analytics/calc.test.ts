import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { cumulativeByWeek, inRange, MAX_WEEKS, weekLabel, weekStart } from "./calc";

const d = (ymd: string, time = "12:00") => new Date(`${ymd}T${time}:00+05:30`);

describe("weekStart", () => {
  it("is the Monday of the week, in India time", () => {
    expect(weekStart(d("2027-02-15"))).toBe("2027-02-15"); // a Monday
    expect(weekStart(d("2027-02-17"))).toBe("2027-02-15");
    expect(weekStart(d("2027-02-21"))).toBe("2027-02-15"); // Sunday belongs to the week before it
    expect(weekStart(d("2027-02-22"))).toBe("2027-02-22");
  });
  it("uses the Indian calendar day, not UTC", () => {
    // 00:30 IST on Monday is still Sunday in UTC.
    expect(weekStart(d("2027-02-15", "00:30"))).toBe("2027-02-15");
    expect(weekStart(d("2027-02-14", "23:59"))).toBe("2027-02-08");
  });
});

describe("weekLabel", () => {
  it("reads like a date", () => {
    expect(weekLabel("2027-02-08")).toBe("8 Feb");
    expect(weekLabel("2026-12-28")).toBe("28 Dec");
  });
});

describe("cumulativeByWeek", () => {
  it("is empty with nothing in it", () => {
    expect(cumulativeByWeek([])).toEqual({ labels: [], values: [], truncated: false });
  });

  it("adds up week by week and keeps quiet weeks as flat stretches", () => {
    const r = cumulativeByWeek([
      { date: d("2027-02-01"), value: 100 },
      { date: d("2027-02-03"), value: 50 },
      { date: d("2027-02-17"), value: 25 },
    ]);
    expect(r.labels).toEqual(["1 Feb", "8 Feb", "15 Feb"]);
    expect(r.values).toEqual([150, 150, 175]);
  });

  it("the last value is the total", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ date: d("2027-01-04"), value: i + 1 }));
    const r = cumulativeByWeek(items);
    expect(r.values.at(-1)).toBe(45);
  });

  it("starts the running total from what came before a chosen range", () => {
    const r = cumulativeByWeek(
      [
        { date: d("2027-01-04"), value: 1000 },
        { date: d("2027-02-01"), value: 10 },
      ],
      { from: "2027-02-01", to: "2027-02-08" },
    );
    expect(r.labels).toEqual(["1 Feb", "8 Feb"]);
    expect(r.values).toEqual([1010, 1010]);
  });

  it("keeps the most recent weeks when there are too many, and says so", () => {
    const r = cumulativeByWeek([
      { date: d("2020-01-06"), value: 1 },
      { date: d("2027-02-01"), value: 1 },
    ]);
    expect(r.truncated).toBe(true);
    expect(r.labels).toHaveLength(MAX_WEEKS);
    expect(r.values.at(-1)).toBe(2);
    expect(r.values[0]).toBe(1);
  });
});

describe("inRange", () => {
  it("is inclusive at both ends and open when a side is missing", () => {
    expect(inRange(d("2027-02-10"), { from: "2027-02-10", to: "2027-02-12" })).toBe(true);
    expect(inRange(d("2027-02-12", "23:00"), { from: "2027-02-10", to: "2027-02-12" })).toBe(true);
    expect(inRange(d("2027-02-09"), { from: "2027-02-10" })).toBe(false);
    expect(inRange(d("2027-02-13"), { to: "2027-02-12" })).toBe(false);
    expect(inRange(d("2030-01-01"), {})).toBe(true);
  });
});
