import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const requireMember = vi.hoisted(() => vi.fn());
const listVendors = vi.hoisted(() => vi.fn());
const listEvents = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("@/modules/vendors/service", () => ({ listVendors }));
vi.mock("@/modules/events/service", () => ({ listEvents }));

import { GET } from "./route";

const day = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);
const inst = (status: string, amount: number, due: string) => ({
  id: due,
  label: "x",
  amount,
  dueDate: day(due),
  status,
});
beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1" });
  listEvents.mockReset().mockResolvedValue([
    { id: "e1", name: "Wedding" },
    { id: "e2", name: "Sangeet" },
  ]);
  listVendors.mockReset().mockResolvedValue([
    {
      spent: 0,
      vendor: {
        id: "v1",
        name: "Royal Caterers",
        category: "caterer",
        phone: "+919876543210",
        email: "r@example.com",
        totalCost: 40_000_000,
        eventIds: ["e1", "e2"],
        notes: "Veg only",
        installments: [
          inst("paid", 10_000_000, "2026-09-01"),
          inst("upcoming", 15_000_000, "2026-12-01"),
          inst("overdue", 5_000_000, "2026-10-01"),
        ],
      },
    },
    {
      spent: 0,
      vendor: { id: "v2", name: "No-price DJ", category: "dj", eventIds: [], installments: [] },
    },
  ]);
});

describe("GET /api/vendors/export", () => {
  it("lists each vendor with what is paid, what is still owed and the next payment due", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("vendors.csv");
    const lines = (await res.text()).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toContain("Total cost (₹),Paid so far (₹),Still to pay (₹),Next payment due");
    // ₹4,00,000 total, ₹1,00,000 paid, ₹3,00,000 to go, the overdue one (1 Oct) is next, events by name.
    expect(lines[1]).toContain("Royal Caterers");
    expect(lines[1]).toContain(
      "400000.00,100000.00,300000.00,2026-10-01,Wedding; Sangeet,Veg only",
    );
    expect(lines[1]).toContain("+919876543210");
  });

  it("leaves the cost and balance blank for a vendor with no agreed price", async () => {
    const lines = (await (await GET()).text()).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[2]).toMatch(/^No-price DJ,.*,,0\.00,,,/);
  });

  it("refuses someone who is not signed in", async () => {
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in to continue"));
    expect((await GET()).status).toBe(401);
    expect(listVendors).not.toHaveBeenCalled();
  });
});
