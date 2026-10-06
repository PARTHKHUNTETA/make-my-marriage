import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMember = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  admitWalkIn: vi.fn(),
  checkInParty: vi.fn(),
  getCounter: vi.fn(),
  lookupEntry: vi.fn(),
  searchParties: vi.fn(),
  syncScans: vi.fn(),
}));
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("@/lib/ratelimit", () => ({
  consumeRateLimit,
  subjectKey: (a: string, b: string) => `${a}:${b}`,
}));
vi.mock("./service", () => service);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  admitWalkInAction,
  checkInAction,
  counterAction,
  lookupEntryAction,
  searchPartiesAction,
  syncScansAction,
} from "./actions";

const E = "507f1f77bcf86cd799439011";
const G = "507f1f77bcf86cd799439012";
const KEY = "scan-key-0001";
const TOKEN = "abcdefghij0123456789AB";

beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1", memberId: "m1" });
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  Object.values(service).forEach((fn) => fn.mockReset().mockResolvedValue({ ok: 1 }));
});

describe("check-in actions", () => {
  it("act for the signed-in member's own wedding, whatever the input says", async () => {
    await lookupEntryAction({ eventId: E, entryToken: TOKEN, weddingId: "evil" });
    expect(service.lookupEntry).toHaveBeenCalledWith("w1", E, TOKEN);
    await searchPartiesAction({ eventId: E, query: "sharma" });
    expect(service.searchParties).toHaveBeenCalledWith("w1", E, "sharma");
    await counterAction({ eventId: E });
    expect(service.getCounter).toHaveBeenCalledWith("w1", E);
  });
  it("check in and walk-in record who did it", async () => {
    await checkInAction({ eventId: E, guestId: G, arrivedCount: "3", clientKey: KEY });
    expect(service.checkInParty).toHaveBeenCalledWith("w1", "m1", {
      eventId: E,
      guestId: G,
      arrivedCount: 3,
      clientKey: KEY,
    });
    await admitWalkInAction({ eventId: E, name: "Raj", arrivedCount: 2, clientKey: KEY });
    expect(service.admitWalkIn).toHaveBeenCalledWith(
      "w1",
      "m1",
      expect.objectContaining({ name: "Raj", arrivedCount: 2 }),
    );
  });
  it("sync sends the whole saved batch", async () => {
    await syncScansAction({ eventId: E, scans: [{ entryToken: TOKEN, clientKey: KEY }] });
    expect(service.syncScans).toHaveBeenCalledWith("w1", "m1", E, [
      expect.objectContaining({ entryToken: TOKEN, clientKey: KEY }),
    ]);
  });
  it("validate before touching anything", async () => {
    expect(
      await checkInAction({ eventId: E, guestId: G, arrivedCount: 0, clientKey: KEY }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(await lookupEntryAction({ eventId: E, entryToken: "x" })).toMatchObject({ ok: false });
    expect(await syncScansAction({ eventId: E, scans: [] })).toMatchObject({ ok: false });
    expect(service.checkInParty).not.toHaveBeenCalled();
    expect(service.lookupEntry).not.toHaveBeenCalled();
  });
  it("are rate limited per member", async () => {
    const { AppError } = await import("@/lib/errors");
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Slow down"));
    expect(await lookupEntryAction({ eventId: E, entryToken: TOKEN })).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(
      await checkInAction({ eventId: E, guestId: G, arrivedCount: 1, clientKey: KEY }),
    ).toMatchObject({ ok: false });
    expect(service.lookupEntry).not.toHaveBeenCalled();
    expect(consumeRateLimit).toHaveBeenCalledWith("checkin", "member:m1", expect.anything());
  });
  it("need a signed-in member", async () => {
    const { AppError } = await import("@/lib/errors");
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    for (const result of [
      await lookupEntryAction({ eventId: E, entryToken: TOKEN }),
      await searchPartiesAction({ eventId: E, query: "ra" }),
      await checkInAction({ eventId: E, guestId: G, arrivedCount: 1, clientKey: KEY }),
      await admitWalkInAction({ eventId: E, name: "R", arrivedCount: 1, clientKey: KEY }),
      await syncScansAction({ eventId: E, scans: [{ entryToken: TOKEN, clientKey: KEY }] }),
      await counterAction({ eventId: E }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(Object.values(service).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
});
