import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMember = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  createVendor: vi.fn(),
  updateVendor: vi.fn(),
  deleteVendor: vi.fn(),
  addInstallment: vi.fn(),
  updateInstallment: vi.fn(),
  deleteInstallment: vi.fn(),
  markInstallmentPaid: vi.fn(),
  markInstallmentUnpaid: vi.fn(),
}));
const getEventsByIds = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("./service", () => service);
vi.mock("@/modules/events/service", () => ({ getEventsByIds }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  addInstallmentAction,
  createVendorAction,
  deleteInstallmentAction,
  deleteVendorAction,
  markInstallmentPaidAction,
  markInstallmentUnpaidAction,
  updateInstallmentAction,
  updateVendorAction,
} from "./actions";

const V = "507f1f77bcf86cd799439011";
const I = "507f1f77bcf86cd799439012";
const E1 = "507f1f77bcf86cd799439013";
const E2 = "507f1f77bcf86cd799439014";
const valid = { name: "Pixel Photography", category: "photographer", eventIds: [E1] };
const plan = { label: "Advance", amount: "50,000", dueDate: "2027-01-10" };

beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1", memberId: "m1" });
  Object.values(service).forEach((fn) => fn.mockReset().mockResolvedValue({ id: "v1" }));
  getEventsByIds.mockReset().mockResolvedValue([{ id: E1 }]);
});

describe("vendor actions", () => {
  it("create: uses the caller's wedding", async () => {
    expect(await createVendorAction({ ...valid, weddingId: "evil" })).toEqual({
      ok: true,
      data: { id: "v1" },
    });
    expect(service.createVendor.mock.calls[0]![0]).toBe("w1");
  });
  it("create and update: refuse an event from another wedding", async () => {
    getEventsByIds.mockResolvedValue([]);
    for (const result of [
      await createVendorAction(valid),
      await updateVendorAction({ vendorId: V, ...valid }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(service.createVendor).not.toHaveBeenCalled();
  });
  it("counts a repeated event once", async () => {
    await createVendorAction({ ...valid, eventIds: [E1, E1] });
    expect(service.createVendor).toHaveBeenCalled();
    expect(await createVendorAction({ ...valid, eventIds: [E1, E2] })).toMatchObject({ ok: false });
  });
  it("validates before touching anything", async () => {
    expect(await createVendorAction({ ...valid, name: "" })).toMatchObject({ ok: false });
    expect(await deleteVendorAction({ vendorId: "nope" })).toMatchObject({ ok: false });
    expect(service.createVendor).not.toHaveBeenCalled();
    expect(service.deleteVendor).not.toHaveBeenCalled();
  });
});

describe("payment schedule actions", () => {
  it("add: passes the amount in paise", async () => {
    await addInstallmentAction({ vendorId: V, ...plan });
    expect(service.addInstallment).toHaveBeenCalledWith(
      "w1",
      V,
      expect.objectContaining({ label: "Advance", amount: 5_000_000 }),
    );
    expect(await addInstallmentAction({ vendorId: V, ...plan, amount: "0" })).toMatchObject({
      ok: false,
    });
  });
  it("update, delete, mark paid and mark unpaid use the caller's wedding", async () => {
    await updateInstallmentAction({ vendorId: V, installmentId: I, ...plan });
    await deleteInstallmentAction({ vendorId: V, installmentId: I });
    await markInstallmentPaidAction({
      vendorId: V,
      installmentId: I,
      paidBy: "couple",
      paidOn: "2027-01-05",
    });
    await markInstallmentUnpaidAction({ vendorId: V, installmentId: I });
    expect(service.updateInstallment.mock.calls[0]![0]).toBe("w1");
    expect(service.deleteInstallment).toHaveBeenCalledWith("w1", V, I);
    expect(service.markInstallmentPaid).toHaveBeenCalledWith("w1", V, I, {
      paidBy: "couple",
      paidOn: "2027-01-05",
    });
    expect(service.markInstallmentUnpaid).toHaveBeenCalledWith("w1", V, I);
  });
  it("mark paid needs one of the three payers", async () => {
    expect(
      await markInstallmentPaidAction({ vendorId: V, installmentId: I, paidBy: "shared" }),
    ).toMatchObject({ ok: false });
    expect(await markInstallmentPaidAction({ vendorId: V, installmentId: I })).toMatchObject({
      ok: false,
    });
    expect(service.markInstallmentPaid).not.toHaveBeenCalled();
  });
});

describe("every action needs a signed-in member", () => {
  it("refuses an anonymous caller", async () => {
    const { AppError } = await import("@/lib/errors");
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    for (const result of [
      await createVendorAction(valid),
      await updateVendorAction({ vendorId: V, ...valid }),
      await deleteVendorAction({ vendorId: V }),
      await addInstallmentAction({ vendorId: V, ...plan }),
      await updateInstallmentAction({ vendorId: V, installmentId: I, ...plan }),
      await deleteInstallmentAction({ vendorId: V, installmentId: I }),
      await markInstallmentPaidAction({ vendorId: V, installmentId: I, paidBy: "couple" }),
      await markInstallmentUnpaidAction({ vendorId: V, installmentId: I }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(Object.values(service).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
});
