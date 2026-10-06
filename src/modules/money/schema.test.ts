import { describe, expect, it } from "vitest";
import { expenseInputSchema, parseExpenseQuery, splitDefaultSchema } from "./schema";

const base = {
  title: "Photographer advance",
  amount: "50,000",
  date: "2027-01-10",
  category: "photography",
  paidBy: "couple",
};
const parse = (over = {}) => expenseInputSchema.safeParse({ ...base, ...over });

describe("expenseInputSchema", () => {
  it("accepts the required fields and turns rupees into paise", () => {
    const r = parse();
    expect(r.success && r.data).toMatchObject({
      amount: 5_000_000,
      category: "photography",
      splits: undefined,
    });
  });
  it("treats blank optional fields as not set", () => {
    const r = parse({ eventId: "", notes: " " });
    expect(r.success && r.data).toMatchObject({ eventId: undefined, notes: undefined });
  });
  it("rejects a missing title, bad amount, bad date, unknown category or payer", () => {
    for (const bad of [
      { title: " " },
      { amount: "0" },
      { amount: "-5" },
      { amount: "12.345" },
      { date: "2027-02-30" },
      { category: "snacks" },
      { paidBy: "uncle" },
      { eventId: "nope" },
    ])
      expect(parse(bad).success).toBe(false);
  });

  describe("shared expenses", () => {
    const shared = { paidBy: "shared", amount: "1000" };
    it("takes percentages that add up to 100", () => {
      const r = parse({ ...shared, shareBride: "50", shareGroom: "50" });
      expect(r.success && r.data.splits).toEqual([
        { payer: "bride_family", percentage: 50 },
        { payer: "groom_family", percentage: 50 },
      ]);
    });
    it("accepts awkward but exact percentages", () => {
      expect(
        parse({ ...shared, shareBride: "33.33", shareGroom: "33.33", shareCouple: "33.34" })
          .success,
      ).toBe(true);
    });
    it("refuses percentages that do not add up, saying what they add up to", () => {
      const r = parse({ ...shared, shareBride: "50", shareGroom: "40" });
      expect(!r.success && r.error.issues[0]?.message).toMatch(/90%/);
      expect(parse({ ...shared, shareBride: "60", shareGroom: "60" }).success).toBe(false);
    });
    it("refuses bad percentages and an empty split", () => {
      expect(parse({ ...shared, shareBride: "abc", shareGroom: "100" }).success).toBe(false);
      expect(parse({ ...shared, shareBride: "-10", shareGroom: "110" }).success).toBe(false);
      expect(parse({ ...shared, shareBride: "12.345", shareGroom: "87.655" }).success).toBe(false);
      expect(parse({ ...shared }).success).toBe(false);
    });
    it("takes fixed amounts that add up to the expense exactly", () => {
      const ok = parse({ ...shared, splitMode: "amount", shareBride: "600", shareCouple: "400" });
      expect(ok.success && ok.data.splits).toEqual([
        { payer: "bride_family", amount: 60_000 },
        { payer: "couple", amount: 40_000 },
      ]);
      expect(
        parse({ ...shared, splitMode: "amount", shareBride: "600", shareCouple: "399.99" }).success,
      ).toBe(false);
      expect(
        parse({ ...shared, splitMode: "amount", shareBride: "600", shareCouple: "400.01" }).success,
      ).toBe(false);
    });
    it("ignores share fields when one payer pays", () => {
      const r = parse({ paidBy: "bride_family", shareBride: "garbage" });
      expect(r.success && r.data.splits).toBeUndefined();
    });
  });
});

describe("splitDefaultSchema", () => {
  it("takes shares that add up to 100", () => {
    const r = splitDefaultSchema.safeParse({
      category: "catering",
      shareBride: "50",
      shareGroom: "50",
      shareCouple: "",
    });
    expect(r.success && r.data).toEqual({
      category: "catering",
      shares: { bride_family: 50, groom_family: 50, couple: 0 },
    });
  });
  it("blank everywhere clears the default", () => {
    const r = splitDefaultSchema.safeParse({ category: "catering" });
    expect(r.success && r.data.shares).toBeNull();
  });
  it("refuses shares that do not add up", () => {
    expect(
      splitDefaultSchema.safeParse({ category: "gifts", shareBride: "70", shareGroom: "20" })
        .success,
    ).toBe(false);
  });
});

describe("parseExpenseQuery", () => {
  it("reads filters and ignores junk", () => {
    expect(
      parseExpenseQuery({ category: "venue", paidBy: "shared", eventId: "none", page: "2" }),
    ).toEqual({
      category: "venue",
      paidBy: "shared",
      eventId: "none",
      page: 2,
    });
    expect(parseExpenseQuery({ category: "x", paidBy: "y", eventId: "z", page: "0" })).toEqual({
      category: undefined,
      paidBy: undefined,
      eventId: undefined,
      page: 1,
    });
  });
});
