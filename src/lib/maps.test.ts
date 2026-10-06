import { describe, expect, it } from "vitest";
import { mapsUrl } from "./maps";

describe("mapsUrl", () => {
  it("searches for the venue and address together, safely encoded", () => {
    expect(mapsUrl("Royal Garden", "1 Palace Rd & Co")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Royal%20Garden%2C%201%20Palace%20Rd%20%26%20Co",
    );
  });
  it("works with either one, and gives nothing when there is neither", () => {
    expect(mapsUrl("Royal Garden")).toContain("Royal%20Garden");
    expect(mapsUrl(undefined, "1 Palace Rd")).toContain("1%20Palace%20Rd");
    expect(mapsUrl()).toBeNull();
    expect(mapsUrl("", "")).toBeNull();
  });
});
