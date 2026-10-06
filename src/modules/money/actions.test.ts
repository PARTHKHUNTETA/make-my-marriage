import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMember = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  setCategoryBudget: vi.fn(),
  setEventBudget: vi.fn(),
}));
const eventExists = vi.hoisted(() => vi.fn());
const wedding = vi.hoisted(() => ({ setOverallBudget: vi.fn(), setSplitDefault: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("./service", () => service);
vi.mock("@/modules/events/service", () => ({ eventExists }));
vi.mock("@/modules/wedding/service", () => wedding);
const vendorExists = vi.hoisted(() => vi.fn());
vi.mock("@/modules/vendors/service", () => ({ vendorExists }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createExpenseAction,
  deleteExpenseAction,
  saveSplitDefaultAction,
  setCategoryBudgetAction,
  setEventBudgetAction,
  setOverallBudgetAction,
  updateExpenseAction,
} from "./actions";

const ID = "507f1f77bcf86cd799439011";
const EV = "507f1f77bcf86cd799439012";
const valid = {
  title: "Venue advance",
  amount: "1,00,000",
  date: "2027-01-10",
  category: "venue",
  paidBy: "couple",
};

beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1", memberId: "m1" });
  Object.values(service).forEach((fn) => fn.mockReset().mockResolvedValue({ id: "x1" }));
  Object.values(wedding).forEach((fn) => fn.mockReset().mockResolvedValue(undefined));
  eventExists.mockReset().mockResolvedValue(true);
  vendorExists.mockReset().mockResolvedValue(true);
});

describe("expense actions", () => {
  it("create: uses the caller's wedding, and stores paise", async () => {
    expect(await createExpenseAction({ ...valid, weddingId: "evil" })).toEqual({
      ok: true,
      data: { id: "x1" },
    });
    const [weddingId, input] = service.createExpense.mock.calls[0]!;
    expect(weddingId).toBe("w1");
    expect(input.amount).toBe(10_000_000);
  });

  it("refuses an event from another wedding", async () => {
    eventExists.mockResolvedValue(false);
    for (const result of [
      await createExpenseAction({ ...valid, eventId: EV }),
      await updateExpenseAction({ expenseId: ID, ...valid, eventId: EV }),
      await setEventBudgetAction({ eventId: EV, amount: "5000" }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(eventExists).toHaveBeenCalledWith("w1", EV);
    expect(service.createExpense).not.toHaveBeenCalled();
    expect(service.setEventBudget).not.toHaveBeenCalled();
  });

  it("validates before touching anything", async () => {
    expect(await createExpenseAction({ ...valid, amount: "-1" })).toMatchObject({ ok: false });
    expect(
      await createExpenseAction({ ...valid, paidBy: "shared", shareBride: "60", shareGroom: "60" }),
    ).toMatchObject({ ok: false });
    expect(await deleteExpenseAction({ expenseId: "nope" })).toMatchObject({ ok: false });
    expect(service.createExpense).not.toHaveBeenCalled();
    expect(service.deleteExpense).not.toHaveBeenCalled();
  });

  it("saves a shared expense with its splits", async () => {
    await createExpenseAction({ ...valid, paidBy: "shared", shareBride: "50", shareGroom: "50" });
    expect(service.createExpense.mock.calls[0]![1].splits).toEqual([
      { payer: "bride_family", percentage: 50 },
      { payer: "groom_family", percentage: 50 },
    ]);
  });
});

describe("vendor link on an expense", () => {
  it("is refused for a vendor from another wedding", async () => {
    vendorExists.mockResolvedValue(false);
    expect(await createExpenseAction({ ...valid, vendorId: ID })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect(vendorExists).toHaveBeenCalledWith("w1", ID);
    expect(service.createExpense).not.toHaveBeenCalled();
  });
  it("is accepted for the wedding's own vendor", async () => {
    expect(await createExpenseAction({ ...valid, vendorId: ID })).toMatchObject({ ok: true });
  });
});

describe("budget actions", () => {
  it("overall budget in paise, and blank removes it", async () => {
    await setOverallBudgetAction({ amount: "60,00,000" });
    expect(wedding.setOverallBudget).toHaveBeenCalledWith("w1", 600_000_000);
    await setOverallBudgetAction({ amount: "" });
    expect(wedding.setOverallBudget).toHaveBeenLastCalledWith("w1", null);
    expect(await setOverallBudgetAction({ amount: "lots" })).toMatchObject({ ok: false });
  });

  it("category and event budgets", async () => {
    await setCategoryBudgetAction({ category: "catering", amount: "2,00,000" });
    expect(service.setCategoryBudget).toHaveBeenCalledWith("w1", "catering", 20_000_000);
    await setEventBudgetAction({ eventId: EV, amount: "" });
    expect(service.setEventBudget).toHaveBeenCalledWith("w1", EV, null);
    expect(await setCategoryBudgetAction({ category: "snacks", amount: "5" })).toMatchObject({
      ok: false,
    });
  });

  it("default split: saves percentages that add to 100, clears when blank", async () => {
    await saveSplitDefaultAction({ category: "catering", shareBride: "50", shareGroom: "50" });
    expect(wedding.setSplitDefault).toHaveBeenCalledWith("w1", "catering", {
      bride_family: 50,
      groom_family: 50,
      couple: 0,
    });
    await saveSplitDefaultAction({ category: "catering" });
    expect(wedding.setSplitDefault).toHaveBeenLastCalledWith("w1", "catering", null);
    expect(await saveSplitDefaultAction({ category: "gifts", shareBride: "10" })).toMatchObject({
      ok: false,
    });
  });
});

describe("every action needs a signed-in member", () => {
  it("refuses an anonymous caller", async () => {
    const { AppError } = await import("@/lib/errors");
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    for (const result of [
      await createExpenseAction(valid),
      await updateExpenseAction({ expenseId: ID, ...valid }),
      await deleteExpenseAction({ expenseId: ID }),
      await setOverallBudgetAction({ amount: "1" }),
      await setCategoryBudgetAction({ category: "venue", amount: "1" }),
      await setEventBudgetAction({ eventId: EV, amount: "1" }),
      await saveSplitDefaultAction({ category: "venue" }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(Object.values(service).every((fn) => fn.mock.calls.length === 0)).toBe(true);
    expect(Object.values(wedding).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
});
