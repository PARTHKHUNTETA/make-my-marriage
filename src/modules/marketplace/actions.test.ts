import { beforeEach, describe, expect, it, vi } from "vitest";

const requireVendor = vi.hoisted(() => vi.fn());
const requireStaff = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  saveMyListing: vi.fn(),
  setListingPaused: vi.fn(),
  decideListing: vi.fn(),
}));
vi.mock("@/lib/authz", () => ({ requireVendor, requireStaff }));
vi.mock("./service", () => service);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { decideListingAction, pauseListingAction, saveListingAction } from "./actions";

const L = "507f1f77bcf86cd799439011";
const valid = { category: "dj", cities: "Pune", description: "Music for every mood." };

beforeEach(() => {
  requireVendor.mockReset().mockResolvedValue({ kind: "vendor", vendorAccountId: "va1" });
  requireStaff.mockReset().mockResolvedValue({ userId: "u1", email: "t@example.com" });
  Object.values(service).forEach((fn) => fn.mockReset().mockResolvedValue({ status: "pending" }));
});

describe("vendor listing actions", () => {
  it("save: always for the signed-in vendor's own account, whatever the input says", async () => {
    expect(await saveListingAction({ ...valid, vendorAccountId: "someone-else" })).toEqual({
      ok: true,
      data: { status: "pending" },
    });
    expect(service.saveMyListing.mock.calls[0]![0]).toBe("va1");
  });
  it("save: validates first", async () => {
    expect(await saveListingAction({ ...valid, cities: "" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect(await saveListingAction({ ...valid, website: "javascript:alert(1)" })).toMatchObject({
      ok: false,
    });
    expect(service.saveMyListing).not.toHaveBeenCalled();
  });
  it("pause and resume use the vendor's own account", async () => {
    await pauseListingAction({ paused: true });
    expect(service.setListingPaused).toHaveBeenCalledWith("va1", true);
    expect(await pauseListingAction({ paused: "yes" })).toMatchObject({ ok: false });
  });
  it("a vendor action refuses anyone without a vendor session", async () => {
    const { AppError } = await import("@/lib/errors");
    requireVendor.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    for (const result of [
      await saveListingAction(valid),
      await pauseListingAction({ paused: true }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(service.saveMyListing).not.toHaveBeenCalled();
    expect(service.setListingPaused).not.toHaveBeenCalled();
  });
});

describe("staff decision action", () => {
  it("passes the decision and note through for staff", async () => {
    await decideListingAction({ listingId: L, decision: "reject", note: "Needs photos" });
    expect(service.decideListing).toHaveBeenCalledWith(L, "reject", "Needs photos");
  });
  it("is refused for anyone who is not staff, before anything changes", async () => {
    const { AppError } = await import("@/lib/errors");
    requireStaff.mockRejectedValue(new AppError("FORBIDDEN", "This area is for the team"));
    expect(await decideListingAction({ listingId: L, decision: "approve" })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(service.decideListing).not.toHaveBeenCalled();
  });
  it("rejects bad input", async () => {
    expect(await decideListingAction({ listingId: "x", decision: "approve" })).toMatchObject({
      ok: false,
    });
    expect(await decideListingAction({ listingId: L, decision: "burn" })).toMatchObject({
      ok: false,
    });
  });
});
