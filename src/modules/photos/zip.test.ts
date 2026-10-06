import { describe, expect, it } from "vitest";
import { planParts, ZIP_PART_BYTES, ZIP_PART_FILES } from "./zip";

const rows = (n: number, bytes: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, bytes }));

describe("planParts", () => {
  it("makes no parts for no photos and one part for a small album", () => {
    expect(planParts([])).toEqual([]);
    expect(planParts(rows(10, 1000))).toHaveLength(1);
  });
  it("starts a new part at the file limit, keeping order and losing nothing", () => {
    const all = rows(ZIP_PART_FILES * 2 + 5, 10);
    const parts = planParts(all);
    expect(parts.map((p) => p.length)).toEqual([ZIP_PART_FILES, ZIP_PART_FILES, 5]);
    expect(parts.flat().map((r) => r.id)).toEqual(all.map((r) => r.id));
  });
  it("starts a new part before the size limit would be passed", () => {
    const big = Math.floor(ZIP_PART_BYTES / 3) + 1; // two fit, three do not
    const parts = planParts(rows(5, big));
    expect(parts.map((p) => p.length)).toEqual([2, 2, 1]);
    for (const p of parts)
      expect(p.reduce((n, r) => n + r.bytes, 0)).toBeLessThanOrEqual(ZIP_PART_BYTES);
  });
  it("gives a single photo bigger than the limit a part of its own", () => {
    const parts = planParts([
      { id: "a", bytes: 10 },
      { id: "huge", bytes: ZIP_PART_BYTES * 2 },
      { id: "b", bytes: 10 },
    ]);
    expect(parts.map((p) => p.map((r) => r.id))).toEqual([["a"], ["huge"], ["b"]]);
  });
});
