import { describe, expect, it } from "vitest";
import { isValidSlug, slugify, SLUG_MAX } from "./slug";

describe("slugify", () => {
  it.each([
    ["Priya weds Aarav", "priya-weds-aarav"],
    ["  Priya   &  Aarav!! ", "priya-aarav"],
    ["Zoë & André", "zoe-andre"],
    ["Anand Karaj 2026", "anand-karaj-2026"],
    ["---wow---", "wow"],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("returns an empty string when nothing Latin is left (the caller supplies a fallback)", () => {
    expect(slugify("प्रिया और आरव")).toBe("");
    expect(slugify("!!!")).toBe("");
  });

  it("caps the length without leaving a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(48)} bbbb`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it.each(["priya-weds-aarav", "abc", "a1b2c3"])("accepts %s", (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each([
    "ab",
    "-abc",
    "abc-",
    "a--b",
    "Priya",
    "has space",
    "under_score",
    "x".repeat(SLUG_MAX + 1),
  ])("rejects %s", (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});
