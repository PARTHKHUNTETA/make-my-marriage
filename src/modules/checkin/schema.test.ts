import { describe, expect, it } from "vitest";
import { checkInSchema, lookupSchema, searchSchema, syncSchema, walkInSchema } from "./schema";

const E = "507f1f77bcf86cd799439011";
const G = "507f1f77bcf86cd799439012";
const KEY = "scan-key-0001";
const TOKEN = "abcdefghij0123456789AB";

describe("checkInSchema", () => {
  it("takes a party, how many arrived (from a form too) and the scan's own key", () => {
    const r = checkInSchema.safeParse({
      eventId: E,
      guestId: G,
      arrivedCount: "4",
      clientKey: KEY,
    });
    expect(r.success && r.data.arrivedCount).toBe(4);
  });
  it("refuses zero, fractions, absurd numbers and a missing or unsafe key", () => {
    for (const bad of [
      { arrivedCount: 0 },
      { arrivedCount: "2.5" },
      { arrivedCount: 1001 },
      { arrivedCount: "" },
      { clientKey: "short" },
      { clientKey: "has spaces here" },
      { clientKey: undefined },
    ])
      expect(
        checkInSchema.safeParse({ eventId: E, guestId: G, arrivedCount: 2, clientKey: KEY, ...bad })
          .success,
      ).toBe(false);
  });
});

describe("walkInSchema", () => {
  it("needs a name and a count; a known party may be named by id", () => {
    expect(
      walkInSchema.safeParse({ eventId: E, name: "Uncle Raj", arrivedCount: 2, clientKey: KEY })
        .success,
    ).toBe(true);
    expect(
      walkInSchema.safeParse({ eventId: E, name: "X", arrivedCount: 2, guestId: G, clientKey: KEY })
        .success,
    ).toBe(true);
    expect(
      walkInSchema.safeParse({ eventId: E, name: " ", arrivedCount: 2, clientKey: KEY }).success,
    ).toBe(false);
    expect(
      walkInSchema.safeParse({
        eventId: E,
        name: "Raj",
        arrivedCount: 2,
        guestId: "nope",
        clientKey: KEY,
      }).success,
    ).toBe(false);
  });
});

describe("lookup and search", () => {
  it("a lookup needs a plausible code, a search at least two letters", () => {
    expect(lookupSchema.safeParse({ eventId: E, entryToken: TOKEN }).success).toBe(true);
    expect(lookupSchema.safeParse({ eventId: E, entryToken: "short" }).success).toBe(false);
    expect(lookupSchema.safeParse({ eventId: E, entryToken: "x".repeat(65) }).success).toBe(false);
    expect(searchSchema.safeParse({ eventId: E, query: "ra" }).success).toBe(true);
    expect(searchSchema.safeParse({ eventId: E, query: "r" }).success).toBe(false);
  });
});

describe("syncSchema", () => {
  const scan = { entryToken: TOKEN, clientKey: KEY };
  it("takes a batch of saved scans, with an optional count and time", () => {
    const r = syncSchema.safeParse({
      eventId: E,
      scans: [
        scan,
        {
          ...scan,
          clientKey: "scan-key-0002",
          arrivedCount: "3",
          scannedAt: "2027-02-13T19:42:00Z",
        },
      ],
    });
    expect(r.success && r.data.scans[1]).toMatchObject({ arrivedCount: 3 });
  });
  it("refuses an empty batch, or an enormous one", () => {
    expect(syncSchema.safeParse({ eventId: E, scans: [] }).success).toBe(false);
    expect(
      syncSchema.safeParse({
        eventId: E,
        scans: Array.from({ length: 101 }, (_, i) => ({
          ...scan,
          clientKey: `scan-key-${1000 + i}`,
        })),
      }).success,
    ).toBe(false);
  });
});
