import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const requireMember = vi.hoisted(() => vi.fn());
const listEveryExpense = vi.hoisted(() => vi.fn());
const listEvents = vi.hoisted(() => vi.fn());
const listVendors = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("@/modules/money/service", () => ({ listEveryExpense }));
vi.mock("@/modules/events/service", () => ({ listEvents }));
vi.mock("@/modules/vendors/service", () => ({ listVendors }));

import { GET } from "./route";

const day = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);
beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1" });
  listEvents.mockReset().mockResolvedValue([{ id: "e1", name: "Sangeet" }]);
  listVendors
    .mockReset()
    .mockResolvedValue([{ vendor: { id: "v1", name: "Royal Caterers" }, spent: 0 }]);
  listEveryExpense.mockReset().mockResolvedValue([
    {
      id: "a",
      title: "Venue deposit",
      amount: 5_000_050,
      date: day("2026-09-07"),
      category: "venue",
      paidBy: "bride_family",
      eventId: "e1",
      vendorId: "v1",
      notes: "Advance",
    },
    {
      id: "b",
      title: '=HYPERLINK("http://evil.test")',
      amount: 120_000,
      date: day("2026-10-02"),
      category: "catering",
      paidBy: "shared",
    },
  ]);
});

describe("GET /api/money/export", () => {
  it("is a spreadsheet of this wedding's expenses, newest first, in rupees, with names not ids", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("expenses.csv");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(listEveryExpense).toHaveBeenCalledWith("w1");
    const lines = (await res.text()).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Date,Title,Category,Amount (₹),Paid by,Event,Vendor,Notes");
    expect(lines[2]).toBe(
      "2026-09-07,Venue deposit,Venue,50000.50,Bride's family,Sangeet,Royal Caterers,Advance",
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]!.startsWith("2026-10-02")).toBe(true); // newest first
  });

  it("cannot be tricked into running a formula when it is opened in a spreadsheet", async () => {
    const text = await (await GET()).text();
    expect(text).toContain("\"'=HYPERLINK(");
    expect(text).not.toMatch(/,=HYPERLINK/);
  });

  it("refuses someone who is not signed in, and reads nothing", async () => {
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in to continue"));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(listEveryExpense).not.toHaveBeenCalled();
  });
});
