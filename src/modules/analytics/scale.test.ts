import { describe, expect, it } from "vitest";
import { chartCsvRows } from "./export";
import { clip, compactValue, niceScale } from "./scale";

describe("niceScale", () => {
  it("gives a round top and evenly spaced ticks that cover the largest value", () => {
    for (const max of [1, 7, 17, 99, 100, 101, 4_321, 5_000_000, 123_456_789]) {
      const { top, ticks } = niceScale(max);
      expect(top).toBeGreaterThanOrEqual(max);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBe(top);
      const gaps = new Set(ticks.slice(1).map((t, i) => Math.round((t - ticks[i]!) * 1e6)));
      expect(gaps.size).toBe(1);
      expect(ticks.length).toBeLessThanOrEqual(8);
    }
    expect(niceScale(17).top).toBe(20);
  });
  it("copes with nothing to draw", () => {
    for (const bad of [0, -5, NaN, Infinity]) {
      const { top, ticks } = niceScale(bad);
      expect(top).toBeGreaterThan(0);
      expect(ticks.length).toBeGreaterThan(1);
    }
  });
});

describe("compactValue", () => {
  it("shortens rupees the way Indians read them, from paise", () => {
    expect(compactValue(80_000, "rupees")).toBe("₹800");
    expect(compactValue(5_000_000, "rupees")).toBe("₹50K");
    expect(compactValue(12_000_000, "rupees")).toBe("₹1.2L");
    expect(compactValue(25_00_00_000 * 100, "rupees")).toBe("₹25Cr");
    expect(compactValue(0, "rupees")).toBe("₹0");
  });
  it("leaves counts alone", () => {
    expect(compactValue(12, "count")).toBe("12");
  });
});

describe("clip", () => {
  it("shortens only what is too long", () => {
    expect(clip("Haldi")).toBe("Haldi");
    expect(clip("Wedding reception dinner", 10)).toBe("Wedding r…");
    expect(clip("Wedding reception dinner", 10)).toHaveLength(10);
  });
});

describe("chartCsvRows", () => {
  const base = { id: "x", title: "t", description: "d" } as const;
  it("writes money in rupees, with the unit in the header", () => {
    const rows = chartCsvRows({
      ...base,
      kind: "groupedBar",
      unit: "rupees",
      labels: ["Venue", "Food"],
      series: [
        { name: "Budget", values: [10_000_000, 5_000_050] },
        { name: "Spent", values: [9_999_999, 0] },
      ],
    });
    expect(rows).toEqual([
      ["Item", "Budget (₹)", "Spent (₹)"],
      ["Venue", 100000, 99999.99],
      ["Food", 50000.5, 0],
    ]);
  });
  it("writes counts as they are, and fills a missing value with 0", () => {
    const rows = chartCsvRows({
      ...base,
      kind: "stackedBar",
      unit: "count",
      labels: ["Haldi", "Sangeet"],
      series: [{ name: "Attending", values: [3] }],
    });
    expect(rows).toEqual([
      ["Item", "Attending"],
      ["Haldi", 3],
      ["Sangeet", 0],
    ]);
  });
  it("labels a weekly line's first column as the week", () => {
    expect(
      chartCsvRows({
        ...base,
        kind: "line",
        unit: "count",
        labels: ["1 Feb"],
        series: [{ name: "Done", values: [2] }],
      })[0]![0],
    ).toBe("Week of");
  });
});

import { analyticsFilterSchema } from "./schema";

describe("analyticsFilterSchema", () => {
  it("accepts no filter, an event, and a date range", () => {
    expect(analyticsFilterSchema.safeParse({}).success).toBe(true);
    expect(analyticsFilterSchema.safeParse({ eventId: "a".repeat(24) }).success).toBe(true);
    expect(analyticsFilterSchema.safeParse({ from: "2027-02-01", to: "2027-02-01" }).success).toBe(
      true,
    );
  });
  it("refuses a bad event, a bad or impossible date, and a backwards range, in plain words", () => {
    const msg = (v: unknown) => {
      const r = analyticsFilterSchema.safeParse(v);
      return r.success ? null : r.error.issues[0]!.message;
    };
    expect(msg({ eventId: "zzz" })).toBe("Choose an event from the list");
    expect(msg({ from: "14/02/2027" })).toMatch(/Use a date/);
    expect(msg({ to: "2027-13-45" })).toBe("Not a real date");
    expect(msg({ from: "2027-03-01", to: "2027-01-01" })).toBe(
      "The start date must be before the end date",
    );
  });
});
