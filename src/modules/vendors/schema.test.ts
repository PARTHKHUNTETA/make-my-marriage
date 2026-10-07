import { describe, expect, it } from "vitest";
import {
  DUE_SOON_DAYS,
  EXPENSE_CATEGORY_FOR,
  VENDOR_CATEGORIES,
  installmentInputSchema,
  installmentStatus,
  markPaidSchema,
  parseVendorQuery,
  vendorInputSchema,
} from "./schema";
import { EXPENSE_CATEGORIES } from "@/modules/money/schema";

const E1 = "507f1f77bcf86cd799439011";
const valid = { name: "Pixel Photography", category: "photographer", eventIds: [] };
const parse = (over = {}) => vendorInputSchema.safeParse({ ...valid, ...over });

describe("vendorInputSchema", () => {
  it("accepts the required fields", () => {
    expect(parse().success).toBe(true);
  });
  it("normalises phone, lowercases email, and turns rupees into paise", () => {
    const r = parse({ phone: "98765 43210", email: " Hello@Pixel.IN ", totalCost: "1,50,000" });
    expect(r.success && r.data).toMatchObject({
      phone: "+919876543210",
      email: "hello@pixel.in",
      totalCost: 15_000_000,
    });
  });
  it("treats blank optional fields as not set", () => {
    const r = parse({ phone: "", email: "", address: " ", totalCost: "", notes: "" });
    expect(r.success && r.data).toMatchObject({
      phone: undefined,
      email: undefined,
      address: undefined,
      totalCost: undefined,
      notes: undefined,
    });
  });
  it("accepts one event as a string or false from a form checkbox", () => {
    const one = parse({ eventIds: E1 });
    expect(one.success && one.data.eventIds).toEqual([E1]);
    const none = parse({ eventIds: false });
    expect(none.success && none.data.eventIds).toEqual([]);
  });
  it("rejects a missing name, unknown category, bad contact details, bad cost and bad event id", () => {
    for (const bad of [
      { name: " " },
      { category: "magician" },
      { phone: "123" },
      { email: "nope" },
      { totalCost: "0" },
      { totalCost: "lots" },
      { eventIds: ["nope"] },
    ])
      expect(parse(bad).success).toBe(false);
  });
});

describe("installmentInputSchema", () => {
  it("needs a label, an amount and a real date", () => {
    const ok = installmentInputSchema.safeParse({
      label: "Advance",
      amount: "50,000",
      dueDate: "2027-01-10",
    });
    expect(ok.success && ok.data.amount).toBe(5_000_000);
    for (const bad of [
      { label: " " },
      { amount: "0" },
      { amount: "abc" },
      { dueDate: "2027-02-30" },
      { dueDate: "" },
    ])
      expect(
        installmentInputSchema.safeParse({
          label: "Advance",
          amount: "1",
          dueDate: "2027-01-10",
          ...bad,
        }).success,
      ).toBe(false);
  });
});

describe("markPaidSchema", () => {
  const ref = { vendorId: E1, installmentId: E1 };
  it("needs a payer from the three, and an optional real date", () => {
    expect(markPaidSchema.safeParse({ ...ref, paidBy: "couple" }).success).toBe(true);
    expect(
      markPaidSchema.safeParse({ ...ref, paidBy: "couple", paidOn: "2027-01-05" }).success,
    ).toBe(true);
    expect(markPaidSchema.safeParse({ ...ref, paidBy: "shared" }).success).toBe(false);
    expect(
      markPaidSchema.safeParse({ ...ref, paidBy: "couple", paidOn: "2027-13-01" }).success,
    ).toBe(false);
  });
});

describe("installmentStatus", () => {
  const due = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);
  const now = new Date("2027-02-10T10:00:00+05:30");
  it("is paid once it has a paid date, whatever the due date", () => {
    expect(installmentStatus({ dueDate: due("2020-01-01"), paidOn: due("2020-01-02") }, now)).toBe(
      "paid",
    );
  });
  it("is overdue after the due day, due soon from 3 days before through the day itself, else upcoming", () => {
    expect(installmentStatus({ dueDate: due("2027-02-09") }, now)).toBe("overdue");
    expect(installmentStatus({ dueDate: due("2027-02-10") }, now)).toBe("due"); // today
    expect(installmentStatus({ dueDate: due("2027-02-13") }, now)).toBe("due"); // 3 days
    expect(installmentStatus({ dueDate: due("2027-02-14") }, now)).toBe("upcoming"); // 4 days
    expect(DUE_SOON_DAYS).toBe(3);
  });
  it("judges the day in India, not UTC", () => {
    // 00:30 IST on the 10th is still the 9th in UTC; a payment due on the 9th is overdue in India.
    expect(
      installmentStatus({ dueDate: due("2027-02-09") }, new Date("2027-02-10T00:30:00+05:30")),
    ).toBe("overdue");
  });
});

describe("expense category for a vendor", () => {
  it("every vendor category files under a real expense category", () => {
    for (const c of VENDOR_CATEGORIES)
      expect(EXPENSE_CATEGORIES).toContain(EXPENSE_CATEGORY_FOR[c]);
    expect(EXPENSE_CATEGORY_FOR.photographer).toBe("photography");
    expect(EXPENSE_CATEGORY_FOR.caterer).toBe("catering");
  });
});

describe("parseVendorQuery", () => {
  it("reads filters and ignores junk", () => {
    expect(parseVendorQuery({ category: "caterer", eventId: E1 })).toEqual({
      category: "caterer",
      eventId: E1,
    });
    expect(parseVendorQuery({ category: "x", eventId: "y" })).toEqual({
      category: undefined,
      eventId: undefined,
    });
  });
});

describe("prefillFromQuery", () => {
  it("takes the Discover fields, trimmed, and drops what does not fit", async () => {
    const { prefillFromQuery } = await import("./schema");
    expect(
      prefillFromQuery({
        name: "  Royal Photography ",
        category: "photographer",
        phone: "098765 43210",
        address: "FC Road, Pune",
      }),
    ).toMatchObject({
      name: "Royal Photography",
      category: "photographer",
      address: "FC Road, Pune",
    });
    expect(prefillFromQuery({ category: "bogus", phone: "abc", name: "x".repeat(400) })).toEqual({
      name: "x".repeat(150),
      category: undefined,
      phone: undefined,
      address: undefined,
    });
    expect(prefillFromQuery({ name: ["a", "b"] }).name).toBeUndefined();
  });
});
