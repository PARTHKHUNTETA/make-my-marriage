import { describe, expect, it } from "vitest";
import {
  daysToGoLabel,
  daysUntil,
  formatLongDate,
  formatMonthYear,
  istDate,
  toIstYmd,
} from "./dates";

describe("istDate", () => {
  it("is midnight in India, which is 18:30 UTC the day before", () => {
    expect(istDate("2026-02-14")?.toISOString()).toBe("2026-02-13T18:30:00.000Z");
  });

  it.each([
    "2026-02-30",
    "2026-13-01",
    "2026-00-10",
    "2025-02-29",
    "abc",
    "2026-2-3",
    "",
    "14-02-2026",
  ])("rejects %s", (value) => {
    expect(istDate(value)).toBeNull();
  });

  it("accepts a leap day only in a leap year", () => {
    expect(istDate("2028-02-29")).not.toBeNull();
    expect(istDate("2027-02-29")).toBeNull();
  });

  it("round-trips through toIstYmd", () => {
    for (const ymd of ["2026-01-01", "2026-12-31", "2028-02-29"]) {
      expect(toIstYmd(istDate(ymd)!)).toBe(ymd);
    }
  });
});

describe("daysUntil", () => {
  const wedding = istDate("2026-02-14")!;

  it("counts whole calendar days in India", () => {
    expect(daysUntil(wedding, istDate("2026-01-03")!)).toBe(42);
    expect(daysUntil(wedding, istDate("2026-02-13")!)).toBe(1);
    expect(daysUntil(wedding, istDate("2026-02-14")!)).toBe(0);
    expect(daysUntil(wedding, istDate("2026-02-26")!)).toBe(-12);
  });

  it("uses the Indian date even when UTC is still on the previous day", () => {
    // 20:00 UTC on 13 Feb is 01:30 IST on 14 Feb: it is already the wedding day.
    expect(daysUntil(wedding, new Date("2026-02-13T20:00:00Z"))).toBe(0);
    // 17:00 UTC on 13 Feb is 22:30 IST on 13 Feb: one day to go.
    expect(daysUntil(wedding, new Date("2026-02-13T17:00:00Z"))).toBe(1);
  });

  it("ignores the time of day", () => {
    expect(daysUntil(wedding, new Date("2026-02-12T00:01:00+05:30"))).toBe(2);
    expect(daysUntil(wedding, new Date("2026-02-12T23:59:00+05:30"))).toBe(2);
  });
});

describe("daysToGoLabel", () => {
  it.each([
    [42, "42 days to go"],
    [2, "2 days to go"],
    [1, "Tomorrow"],
    [0, "Today"],
    [-1, "Married 1 day ago"],
    [-12, "Married 12 days ago"],
  ])("%i -> %s", (days, label) => {
    expect(daysToGoLabel(days)).toBe(label);
  });
});

describe("formatting", () => {
  it("formats in the Indian calendar regardless of server time zone", () => {
    const date = istDate("2026-02-14")!;
    expect(formatLongDate(date)).toBe("14 February 2026");
    expect(formatMonthYear(date)).toMatch(/Feb(ruary)? 2026/);
  });
});
