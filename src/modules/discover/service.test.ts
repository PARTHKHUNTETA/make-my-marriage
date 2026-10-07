import { beforeEach, describe, expect, it, vi } from "vitest";

const searchPlaces = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
vi.mock("./google", () => ({ searchPlaces }));
vi.mock("@/lib/ratelimit", () => ({
  consumeRateLimit,
  subjectKey: (a: string, b: string) => `${a}:${b}`,
}));

import { discoverVendors } from "./service";
import { placesQuery } from "./schema";

beforeEach(() => {
  searchPlaces.mockReset().mockResolvedValue([{ placeId: "p", name: "A" }]);
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
});

describe("discoverVendors", () => {
  it("builds the search from the category and city, and counts it against the wedding", async () => {
    const r = await discoverVendors("w1", { category: "makeup_artist", city: "Pune" });
    expect(r).toEqual({ configured: true, places: [{ placeId: "p", name: "A" }] });
    expect(searchPlaces).toHaveBeenCalledWith("wedding makeup artist in Pune");
    expect(consumeRateLimit).toHaveBeenCalledWith("discover", "wedding:w1", {
      limit: 30,
      windowSeconds: 86400,
    });
  });

  it("says it is not set up, without spending a search, when there is no key", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(await discoverVendors("w1", { category: "venue", city: "Pune" })).toEqual({
      configured: false,
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it("stops at the daily limit before calling Google", async () => {
    consumeRateLimit.mockRejectedValue(new Error("RATE_LIMITED"));
    await expect(discoverVendors("w1", { category: "venue", city: "Pune" })).rejects.toThrow();
    expect(searchPlaces).not.toHaveBeenCalled();
  });
});

describe("placesQuery", () => {
  it("handles the catch-all category", () => {
    expect(placesQuery({ category: "other", city: "Goa" })).toBe("wedding services in Goa");
  });
});
