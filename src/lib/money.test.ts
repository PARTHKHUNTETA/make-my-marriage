import { describe, expect, it } from "vitest";
import { MAX_PAISE, formatRupees, parseRupees, toRupeeInput } from "./money";

describe("parseRupees", () => {
  it("turns rupees into whole paise without floating point error", () => {
    expect(parseRupees("50000")).toBe(5_000_000);
    expect(parseRupees("1,50,000")).toBe(15_000_000);
    expect(parseRupees("₹ 499.5")).toBe(49_950);
    expect(parseRupees("0.29")).toBe(29); // 0.29 * 100 is 28.999999999999996 in floating point
    expect(parseRupees("1.10")).toBe(110);
    expect(parseRupees("Rs. 12")).toBe(1_200);
  });
  it("rejects zero, negatives, three decimals, text and absurd sizes", () => {
    for (const bad of ["", "0", "0.00", "-5", "1.234", "abc", "1e5", "12.", ".5", "1,2,3.4.5"])
      expect(parseRupees(bad)).toBeNull();
    expect(parseRupees(String(MAX_PAISE / 100))).toBe(MAX_PAISE);
    expect(parseRupees(String(MAX_PAISE / 100 + 1))).toBeNull();
  });
});

describe("formatRupees", () => {
  it("uses Indian grouping and shows decimals only when needed", () => {
    expect(formatRupees(15_000_000)).toBe("₹1,50,000");
    expect(formatRupees(49_950)).toBe("₹499.50");
    expect(formatRupees(10_000_000_00)).toBe("₹1,00,00,000");
    expect(formatRupees(5)).toBe("₹0.05");
  });
});

describe("toRupeeInput", () => {
  it("round-trips through parseRupees", () => {
    for (const paise of [100, 49_950, 15_000_000, 1, 99])
      expect(parseRupees(toRupeeInput(paise))).toBe(paise);
  });
});
