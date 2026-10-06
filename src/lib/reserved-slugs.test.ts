import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isReservedSlug, RESERVED_SLUGS } from "./reserved-slugs";

const appDir = path.join(process.cwd(), "src/app");

// URL segments that sit directly under the site root. Route groups like (member) add no
// segment, so their children count as top-level. Dynamic segments ([slug], [token]) do not.
function topLevelSegments(): string[] {
  const dirs = (p: string) =>
    readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory());
  const isStatic = (name: string) => !/^[([_]/.test(name);
  const segments: string[] = [];
  for (const entry of dirs(appDir)) {
    if (entry.name.startsWith("(")) {
      for (const child of dirs(path.join(appDir, entry.name))) {
        if (isStatic(child.name)) segments.push(child.name);
      }
    } else if (isStatic(entry.name)) {
      segments.push(entry.name);
    }
  }
  return segments;
}

describe("reserved slugs", () => {
  it("includes every real top-level route, so a wedding slug can never shadow a page", () => {
    const segments = topLevelSegments();
    expect(segments.length).toBeGreaterThan(10);
    const missing = segments.filter((s) => !RESERVED_SLUGS.has(s));
    expect(missing).toEqual([]);
  });

  it("matches case-insensitively", () => {
    expect(isReservedSlug("Dashboard")).toBe(true);
    expect(isReservedSlug("API")).toBe(true);
  });

  it("allows ordinary wedding slugs", () => {
    expect(isReservedSlug("priya-weds-aarav")).toBe(false);
    expect(isReservedSlug("ananya-and-rohan-2026")).toBe(false);
  });

  it("only holds lowercase values, so lookups stay consistent", () => {
    for (const slug of RESERVED_SLUGS) expect(slug).toBe(slug.toLowerCase());
  });
});
