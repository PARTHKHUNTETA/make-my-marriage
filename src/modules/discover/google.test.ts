import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchPlaces } from "./google";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const reply = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("searchPlaces", () => {
  it("does nothing without a key", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "  ");
    expect(await searchPlaces("wedding photographer in Pune")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks Google for only the fields it shows, with the key in a header, never the URL", async () => {
    reply({ places: [] });
    await searchPlaces("wedding photographer in Pune");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(url).not.toContain("test-key");
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-key");
    expect(init.headers["X-Goog-FieldMask"]).not.toContain("reviews");
    expect(JSON.parse(init.body)).toMatchObject({
      textQuery: "wedding photographer in Pune",
      regionCode: "IN",
    });
    expect(init.cache).toBe("no-store");
  });

  it("maps places, and drops any without an id or a name", async () => {
    reply({
      places: [
        {
          id: "p1",
          displayName: { text: "Royal Photography" },
          formattedAddress: "FC Road, Pune",
          nationalPhoneNumber: "098765 43210",
          rating: 4.7,
          userRatingCount: 120,
          googleMapsUri: "https://maps.google.com/?cid=1",
        },
        { id: "p2" },
        { displayName: { text: "No id" } },
      ],
    });
    expect(await searchPlaces("x")).toEqual([
      {
        placeId: "p1",
        name: "Royal Photography",
        address: "FC Road, Pune",
        phone: "098765 43210",
        rating: 4.7,
        ratingCount: 120,
        mapsUrl: "https://maps.google.com/?cid=1",
        website: undefined,
      },
    ]);
  });

  it("returns an empty list when Google finds nothing", async () => {
    reply({});
    expect(await searchPlaces("x")).toEqual([]);
  });

  it("fails with a plain message when Google refuses or cannot be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    reply({ error: { message: "key restricted: test-key" } }, 403);
    await expect(searchPlaces("x")).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(searchPlaces("x")).rejects.not.toThrow(/test-key/);
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(searchPlaces("x")).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
