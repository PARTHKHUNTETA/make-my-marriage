import { describe, expect, it } from "vitest";
import { PALETTES } from "./kit";

// WCAG relative luminance and contrast ratio for #rrggbb colours.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("every palette is readable", () => {
  for (const [id, p] of Object.entries(PALETTES)) {
    it(id, () => {
      expect(contrast(p.ink, p.bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(p.ink, p.surface)).toBeGreaterThanOrEqual(7);
      expect(contrast(p.heading, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.heading, p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.heroInk, p.heroSolid)).toBeGreaterThanOrEqual(4.5);
      // Every colour in a gradient hero must carry the hero text too.
      for (const stop of p.heroBg.match(/#[0-9a-f]{6}/gi) ?? []) {
        expect(contrast(p.heroInk, stop), `${id} hero stop ${stop}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
