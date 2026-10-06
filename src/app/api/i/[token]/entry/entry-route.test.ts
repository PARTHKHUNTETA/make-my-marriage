import { beforeEach, describe, expect, it, vi } from "vitest";

const getEntryTokenForGuest = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/modules/guests/service", () => ({ getEntryTokenForGuest }));
vi.mock("@/lib/ratelimit", () => ({
  consumeRateLimit,
  subjectKey: (a: string, b: string) => `${a}:${b}`,
  clientIp: () => "1.2.3.4",
}));

import { GET } from "./[eventId]/route";

const call = (token = "guesttoken123456789012", eventId = "507f1f77bcf86cd799439011") =>
  GET(new Request("http://app.test/x"), { params: Promise.resolve({ token, eventId }) });

beforeEach(() => {
  getEntryTokenForGuest.mockReset();
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/i/[token]/entry/[eventId]", () => {
  it("returns a PNG for a party that is coming, private to the guest's device", async () => {
    getEntryTokenForGuest.mockResolvedValue("entrytoken123456789012");
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("private");
    expect([...new Uint8Array(await res.arrayBuffer()).subarray(0, 4)]).toEqual([
      0x89, 0x50, 0x4e, 0x47,
    ]);
    expect(getEntryTokenForGuest).toHaveBeenCalledWith(
      "guesttoken123456789012",
      "507f1f77bcf86cd799439011",
    );
  });
  it("is a plain not-found for anyone else: an unknown link, or a party that is not coming", async () => {
    getEntryTokenForGuest.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).not.toBe("image/png");
  });
  it("is rate limited by address", async () => {
    const { AppError } = await import("@/lib/errors");
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Slow down"));
    expect((await call()).status).toBe(429);
    expect(getEntryTokenForGuest).not.toHaveBeenCalled();
  });
});
