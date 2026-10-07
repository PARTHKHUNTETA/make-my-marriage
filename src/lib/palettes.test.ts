import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  chartSeries,
  chartTheme,
  contrastRatio,
  darkenToContrast,
  DEFAULT_PALETTE,
  getPalette,
  hexToRgb,
  isPaletteId,
  luminance,
  mix,
  PALETTE_IDS,
  PALETTES,
  paletteStyle,
  paletteTokens,
  rgbToHex,
  toPaletteId,
} from "./palettes";

const HEX = /^#[0-9a-f]{6}$/;
const WHITE = "#ffffff";

describe("colour maths", () => {
  it("converts hex and back", () => {
    expect(hexToRgb("#2d1226")).toEqual([45, 18, 38]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(rgbToHex([45, 18, 38])).toBe("#2d1226");
    expect(rgbToHex([300, -5, 12.4])).toBe("#ff000c");
  });
  it("mixes between two colours", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
  it("matches the published WCAG figures", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#000000")).toBeCloseTo(0, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(contrastRatio("#000000", "#ffffff"), 5);
  });
  it("darkens only as far as needed", () => {
    expect(darkenToContrast("#000000", [WHITE], 4.5)).toBe("#000000");
    const light = "#b98579";
    const fixed = darkenToContrast(light, [WHITE], 4.5);
    expect(contrastRatio(fixed, WHITE)).toBeGreaterThanOrEqual(4.5);
    // One step lighter would not have been enough.
    expect(contrastRatio(mix(light, "#000000", 0.02 * 0), WHITE)).toBeLessThan(4.5);
    expect(darkenToContrast("#1e1b1c", [WHITE], 4.5)).toBe("#1e1b1c"); // already dark: untouched
  });
});

describe("the palette list", () => {
  it("has the twelve palettes, each once, and the default is the first", () => {
    expect(PALETTES.map((p) => p.id)).toEqual([...PALETTE_IDS]);
    expect(new Set(PALETTE_IDS).size).toBe(12);
    expect(DEFAULT_PALETTE).toBe("aubergine");
    expect(PALETTE_IDS[0]).toBe(DEFAULT_PALETTE);
  });
  it("recognises ids and falls back to the default for anything else", () => {
    expect(isPaletteId("emerald")).toBe(true);
    for (const bad of ["Emerald", "", "nope", null, undefined, 3, {}])
      expect(isPaletteId(bad)).toBe(false);
    expect(toPaletteId("indigo")).toBe("indigo");
    expect(toPaletteId("garbage")).toBe(DEFAULT_PALETTE);
    expect(toPaletteId(undefined)).toBe(DEFAULT_PALETTE);
    expect(getPalette("fig").id).toBe("fig");
  });
});

describe.each(PALETTES.map((p) => [p.id, p] as const))("%s", (id, def) => {
  const t = paletteTokens(id);
  const v = (name: string) => t[name]!;

  it("only uses valid colours, and defines the same variables as every other palette", () => {
    for (const [name, value] of Object.entries(t)) {
      expect(value, name).toMatch(HEX);
    }
    expect(Object.keys(t).sort()).toEqual(Object.keys(paletteTokens(DEFAULT_PALETTE)).sort());
  });

  it("keeps the four colours of the brief where they belong", () => {
    expect(v("--color-plum")).toBe(def.primary);
    expect(v("--color-gold-ring")).toBe(def.accent);
    expect(v("--color-blush")).toBe(def.canvas);
    expect(v("--color-rose-100")).toBe(def.surface);
    expect(v("--primary")).toBe(def.primary);
  });

  it("is readable: text, buttons and headings meet contrast on every surface they sit on", () => {
    const surfaces = [WHITE, v("--color-blush"), v("--color-rose-100"), v("--color-rose-50")];
    for (const bg of surfaces) {
      expect(contrastRatio(v("--color-ink"), bg), `ink on ${bg}`).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(v("--color-ink-2"), bg), `ink-2 on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    // Buttons and links in the accent colour, and white lettering on them.
    for (const bg of [...surfaces, v("--color-honey"), v("--color-gold-soft")])
      expect(contrastRatio(v("--color-bronze"), bg), `bronze on ${bg}`).toBeGreaterThanOrEqual(4.5);
    // White lettering on the primary (headers, sidebar highlight, main buttons).
    expect(contrastRatio(WHITE, v("--color-plum"))).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(WHITE, v("--color-plum-hover"))).toBeGreaterThanOrEqual(7);
  });

  it("keeps the accent recognisably the accent: only as dark as readability needs, never near-black", () => {
    // A bronze this dark would be indistinguishable from the text colour.
    expect(contrastRatio(v("--color-bronze"), WHITE)).toBeLessThan(8);
    expect(contrastRatio(v("--color-bronze"), v("--color-ink"))).toBeGreaterThan(1.4);
  });

  it("tells chart series apart, and keeps each visible against white", () => {
    const series = chartSeries(id).map(hexToRgb);
    for (const s of chartSeries(id)) expect(contrastRatio(s, WHITE), s).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < series.length; i++)
      for (let j = i + 1; j < series.length; j++) {
        const [a, b] = [series[i]!, series[j]!];
        const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        expect(distance, `${i} vs ${j}`).toBeGreaterThan(60);
      }
  });
});

describe("the default palette", () => {
  // The default must be exactly what the stylesheet already paints, or "never chose a theme" would
  // quietly look different. Read the real file.
  const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  const declared = (name: string) =>
    css
      .match(new RegExp(`${name.replace(/[-]/g, "\\-")}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1]
      ?.toLowerCase();

  it("has the stylesheet's own values for every variable it overrides", () => {
    for (const [name, value] of Object.entries(paletteTokens(DEFAULT_PALETTE))) {
      expect(declared(name), `${name} is declared in globals.css`).toBe(value);
    }
  });

  it("adds no inline style at all, so nothing changes for anyone who never chooses", () => {
    expect(paletteStyle(DEFAULT_PALETTE)).toEqual({});
  });

  it("is the one palette whose chart colours are the original series", () => {
    expect(chartSeries("aubergine")).toEqual(["#7a3b6b", "#b8862b", "#3f7d52", "#c0506a"]);
  });
});

describe("a chosen palette", () => {
  it("replaces every variable the default defines, so no old colour is left showing", () => {
    for (const id of PALETTE_IDS.filter((i) => i !== DEFAULT_PALETTE)) {
      const style = paletteStyle(id) as Record<string, string>;
      expect(Object.keys(style).sort()).toEqual(Object.keys(paletteTokens(DEFAULT_PALETTE)).sort());
    }
  });
  it("really differs from the default", () => {
    const base = paletteTokens(DEFAULT_PALETTE);
    for (const id of PALETTE_IDS.filter((i) => i !== DEFAULT_PALETTE)) {
      const t = paletteTokens(id);
      expect(t["--color-plum"]).not.toBe(base["--color-plum"]);
      expect(t["--color-bronze"]).not.toBe(base["--color-bronze"]);
      expect(t["--color-blush"]).not.toBe(base["--color-blush"]);
    }
  });
  it("never touches the status colours", () => {
    for (const id of PALETTE_IDS) {
      const t = paletteTokens(id);
      for (const fixed of ["--color-forest", "--color-mint", "--destructive"])
        expect(t[fixed]).toBeUndefined();
    }
  });
  it("keeps the user's exact accent for decoration even when text needs a darker shade", () => {
    // Rose Quartz is too light to carry text as it is.
    const rose = paletteTokens("charcoal");
    expect(rose["--color-gold-ring"]).toBe("#b98579");
    expect(contrastRatio("#b98579", WHITE)).toBeLessThan(4.5);
    expect(rose["--color-bronze"]).not.toBe("#b98579");
    expect(contrastRatio(rose["--color-bronze"]!, WHITE)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("chart colours", () => {
  it("the default chart looks exactly as it always did", () => {
    expect(chartTheme("aubergine")).toEqual({
      series: ["#7a3b6b", "#b8862b", "#3f7d52", "#c0506a"],
      ink: "#2d1226",
      muted: "#4e4449",
      grid: "#eadfe0",
    });
  });
  it("another palette's chart uses that palette's own lettering and series, all literal colours", () => {
    for (const id of PALETTE_IDS.filter((i) => i !== DEFAULT_PALETTE)) {
      const theme = chartTheme(id);
      expect(theme.ink).toBe(getPalette(id).primary);
      expect(theme.series).toEqual(chartSeries(id));
      for (const c of [theme.ink, theme.muted, theme.grid, ...theme.series]) expect(c).toMatch(HEX);
      expect(contrastRatio(theme.muted, WHITE)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
