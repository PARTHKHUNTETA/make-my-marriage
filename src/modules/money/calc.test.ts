import { describe, expect, it } from "vitest";
import { allocate, budgetRow, contributions, summarize } from "./calc";
import type { ExpenseItem } from "./schema";

const sum = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0);
const expense = (over: Partial<ExpenseItem> = {}): ExpenseItem => ({
  id: "x",
  title: "Thing",
  amount: 100_000,
  date: new Date(),
  category: "catering",
  paidBy: "couple",
  ...over,
});

describe("allocate", () => {
  it("splits evenly", () => {
    expect(
      allocate(100_000, [
        { payer: "bride_family", percentage: 50 },
        { payer: "groom_family", percentage: 50 },
      ]),
    ).toEqual({ bride_family: 50_000, groom_family: 50_000, couple: 0 });
  });

  it("always adds back up to the total to the paisa, however awkward the percentages", () => {
    const cases: Array<[number, number[]]> = [
      [100, [33.33, 33.33, 33.34]],
      [1, [50, 50]],
      [999_999, [33.33, 33.33, 33.34]],
      [7, [33.33, 33.33, 33.34]],
      [1_000_001, [12.5, 12.5, 75]],
      [3, [0.01, 0.01, 99.98]],
      [123_457, [40, 35, 25]],
    ];
    for (const [total, pcts] of cases) {
      const result = allocate(
        total,
        pcts.map((percentage, i) => ({
          payer: (["bride_family", "groom_family", "couple"] as const)[i]!,
          percentage,
        })),
      );
      expect(sum(result)).toBe(total);
      for (const v of Object.values(result)) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("gives the odd paisa to the largest remainder, ties to bride then groom", () => {
    expect(
      allocate(1, [
        { payer: "bride_family", percentage: 50 },
        { payer: "groom_family", percentage: 50 },
      ]),
    ).toEqual({ bride_family: 1, groom_family: 0, couple: 0 });
    expect(
      allocate(100, [
        { payer: "bride_family", percentage: 33.33 },
        { payer: "groom_family", percentage: 33.33 },
        { payer: "couple", percentage: 33.34 },
      ]),
    ).toEqual({ bride_family: 33, groom_family: 33, couple: 34 });
  });

  it("uses fixed amounts as they are", () => {
    expect(
      allocate(100_000, [
        { payer: "bride_family", amount: 60_000 },
        { payer: "couple", amount: 40_000 },
      ]),
    ).toEqual({ bride_family: 60_000, groom_family: 0, couple: 40_000 });
  });

  it("is all zeros with no splits", () => {
    expect(allocate(500, [])).toEqual({ bride_family: 0, groom_family: 0, couple: 0 });
  });
});

describe("contributions", () => {
  it("one payer pays the whole expense", () => {
    expect(contributions(expense({ paidBy: "groom_family", amount: 700 }))).toEqual({
      bride_family: 0,
      groom_family: 700,
      couple: 0,
    });
  });
  it("a shared expense is divided by its splits", () => {
    expect(
      contributions(
        expense({
          paidBy: "shared",
          amount: 1001,
          splits: [
            { payer: "bride_family", percentage: 50 },
            { payer: "groom_family", percentage: 50 },
          ],
        }),
      ),
    ).toEqual({ bride_family: 501, groom_family: 500, couple: 0 });
  });
});

describe("summarize", () => {
  const e1 = expense({
    amount: 300_000,
    category: "venue",
    eventId: "ev1",
    paidBy: "bride_family",
  });
  const e2 = expense({
    amount: 100_001,
    category: "catering",
    eventId: "ev1",
    paidBy: "shared",
    splits: [
      { payer: "bride_family", percentage: 50 },
      { payer: "groom_family", percentage: 50 },
    ],
  });
  const e3 = expense({ amount: 50_000, category: "catering", paidBy: "couple" });

  it("totals by category, event and payer, and the payers always add up to the total", () => {
    const s = summarize([e1, e2, e3]);
    expect(s.total).toBe(450_001);
    expect(s.byCategory).toEqual({ venue: 300_000, catering: 150_001 });
    expect(s.byEvent).toEqual({ ev1: 400_001, none: 50_000 });
    expect(s.byPayer).toEqual({ bride_family: 350_001, groom_family: 50_000, couple: 50_000 });
    expect(sum(s.byPayer)).toBe(s.total);
    expect(s.byPayerByCategory.catering).toEqual({
      bride_family: 50_001,
      groom_family: 50_000,
      couple: 50_000,
    });
  });

  it("is empty for no expenses", () => {
    expect(summarize([])).toMatchObject({ total: 0, byCategory: {}, byEvent: {} });
  });
});

describe("budgetRow", () => {
  it("works out remaining and percent used", () => {
    expect(budgetRow("venue", "Venue", 1_000_00, 400_00)).toMatchObject({
      remaining: 600_00,
      percentUsed: 40,
      over: false,
    });
  });
  it("flags going over budget, and exactly on budget is not over", () => {
    expect(budgetRow("v", "V", 100, 150)).toMatchObject({
      remaining: -50,
      percentUsed: 150,
      over: true,
    });
    expect(budgetRow("v", "V", 100, 100)).toMatchObject({
      remaining: 0,
      percentUsed: 100,
      over: false,
    });
  });
  it("has no limits when there is no budget", () => {
    expect(budgetRow("v", "V", null, 500)).toMatchObject({
      remaining: null,
      percentUsed: null,
      over: false,
    });
  });
});
