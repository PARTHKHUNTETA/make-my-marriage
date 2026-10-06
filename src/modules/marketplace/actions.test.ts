import { beforeEach, describe, expect, it, vi } from "vitest";

const requireVendor = vi.hoisted(() => vi.fn());
const requireStaff = vi.hoisted(() => vi.fn());
const requireMember = vi.hoisted(() => vi.fn());
const getEventsByIds = vi.hoisted(() => vi.fn());
const getWedding = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  saveMyListing: vi.fn(),
  setListingPaused: vi.fn(),
  decideListing: vi.fn(),
  sendBookingRequest: vi.fn(),
  cancelBooking: vi.fn(),
  acceptQuote: vi.fn(),
  quoteRequest: vi.fn(),
  declineRequest: vi.fn(),
}));
vi.mock("@/lib/authz", () => ({ requireVendor, requireStaff, requireMember }));
vi.mock("@/modules/events/service", () => ({ getEventsByIds }));
vi.mock("@/modules/wedding/service", () => ({ getWedding }));
vi.mock("@/lib/ratelimit", () => ({
  consumeRateLimit,
  subjectKey: (a: string, b: string) => `${a}:${b}`,
}));
vi.mock("./service", () => service);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  acceptQuoteAction,
  cancelBookingAction,
  declineRequestAction,
  decideListingAction,
  pauseListingAction,
  quoteRequestAction,
  saveListingAction,
  sendBookingRequestAction,
} from "./actions";

const L = "507f1f77bcf86cd799439011";
const E1 = "507f1f77bcf86cd799439021";
const E2 = "507f1f77bcf86cd799439022";
const valid = { category: "dj", cities: "Pune", description: "Music for every mood." };

beforeEach(() => {
  requireVendor.mockReset().mockResolvedValue({ kind: "vendor", vendorAccountId: "va1" });
  requireStaff.mockReset().mockResolvedValue({ userId: "u1", email: "t@example.com" });
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1", memberId: "m1" });
  getEventsByIds
    .mockReset()
    .mockResolvedValue([{ id: E1, name: "Sangeet", date: new Date("2027-02-13") }]);
  getWedding.mockReset().mockResolvedValue({ city: "Jaipur" });
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  Object.values(service).forEach((fn) =>
    fn.mockReset().mockResolvedValue({ status: "pending", id: "r1" }),
  );
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

describe("booking request actions (couples)", () => {
  const request = { listingId: L, eventIds: [E1] };

  it("sends the wedding's own events as snapshots, and defaults the city to the wedding's", async () => {
    expect(await sendBookingRequestAction({ ...request, weddingId: "evil" })).toEqual({
      ok: true,
      data: { id: "r1" },
    });
    const [weddingId, input, events] = service.sendBookingRequest.mock.calls[0]!;
    expect(weddingId).toBe("w1");
    expect(input.city).toBe("Jaipur");
    expect(events).toEqual({
      ids: [E1],
      snapshots: [{ name: "Sangeet", date: new Date("2027-02-13") }],
    });
    expect(getEventsByIds).toHaveBeenCalledWith("w1", [E1]);
  });
  it("keeps a city the couple typed", async () => {
    await sendBookingRequestAction({ ...request, city: "Udaipur" });
    expect(service.sendBookingRequest.mock.calls[0]![1].city).toBe("Udaipur");
  });
  it("refuses an event from another wedding, and needs at least one event", async () => {
    getEventsByIds.mockResolvedValue([]);
    expect(await sendBookingRequestAction(request)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect(await sendBookingRequestAction({ ...request, eventIds: [] })).toMatchObject({
      ok: false,
    });
    expect(await sendBookingRequestAction({ ...request, eventIds: [E1, E2] })).toMatchObject({
      ok: false,
    });
    expect(service.sendBookingRequest).not.toHaveBeenCalled();
  });
  it("is rate limited per wedding", async () => {
    const { AppError } = await import("@/lib/errors");
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Slow down"));
    expect(await sendBookingRequestAction(request)).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(service.sendBookingRequest).not.toHaveBeenCalled();
  });
  it("validates contact details and headcount", async () => {
    expect(await sendBookingRequestAction({ ...request, contactPhone: "12" })).toMatchObject({
      ok: false,
    });
    expect(await sendBookingRequestAction({ ...request, expectedHeadcount: "0" })).toMatchObject({
      ok: false,
    });
    expect(
      await sendBookingRequestAction({
        ...request,
        expectedHeadcount: "250",
        contactPhone: "98765 43210",
      }),
    ).toMatchObject({ ok: true });
    expect(service.sendBookingRequest.mock.calls[0]![1]).toMatchObject({
      expectedHeadcount: 250,
      contactPhone: "+919876543210",
    });
  });
  it("cancel and accept use the caller's wedding; accept carries the amount the couple saw", async () => {
    await cancelBookingAction({ requestId: L });
    expect(service.cancelBooking).toHaveBeenCalledWith("w1", L);
    await acceptQuoteAction({ requestId: L, amount: 15_000_000 });
    expect(service.acceptQuote).toHaveBeenCalledWith("w1", L, 15_000_000);
    expect(await acceptQuoteAction({ requestId: L, amount: 0 })).toMatchObject({ ok: false });
    expect(await acceptQuoteAction({ requestId: "x", amount: 5 })).toMatchObject({ ok: false });
  });
  it("need a signed-in member", async () => {
    const { AppError } = await import("@/lib/errors");
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    for (const result of [
      await sendBookingRequestAction(request),
      await cancelBookingAction({ requestId: L }),
      await acceptQuoteAction({ requestId: L, amount: 5 }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(service.sendBookingRequest).not.toHaveBeenCalled();
    expect(service.acceptQuote).not.toHaveBeenCalled();
  });
});

describe("booking request actions (vendors)", () => {
  it("quote and decline always act as the signed-in vendor", async () => {
    await quoteRequestAction({ requestId: L, amount: "1,50,000", vendorAccountId: "someone-else" });
    expect(service.quoteRequest).toHaveBeenCalledWith("va1", L, 15_000_000);
    await declineRequestAction({ requestId: L });
    expect(service.declineRequest).toHaveBeenCalledWith("va1", L);
  });
  it("refuse a bad price and anyone without a vendor session", async () => {
    expect(await quoteRequestAction({ requestId: L, amount: "0" })).toMatchObject({ ok: false });
    expect(await quoteRequestAction({ requestId: L, amount: "lots" })).toMatchObject({ ok: false });
    const { AppError } = await import("@/lib/errors");
    requireVendor.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    expect(await quoteRequestAction({ requestId: L, amount: "5" })).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(await declineRequestAction({ requestId: L })).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(service.quoteRequest).not.toHaveBeenCalled();
    expect(service.declineRequest).not.toHaveBeenCalled();
  });
});
