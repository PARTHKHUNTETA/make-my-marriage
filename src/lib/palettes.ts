import type { CSSProperties } from "react";

// The app's colour themes (Settings → Appearance). Pure and free of server code, so the picker, the
// layout and the tests all read the same definitions.
//
// Each palette is defined by the four colours the design brief names: a deep primary, a metallic
// accent, a canvas and a secondary surface. Everything else the app paints with (text, borders,
// highlights, chart colours) is worked out from those four, so a palette cannot end up half-themed.
//
// Two rules keep every palette readable:
//   - The metallic accent is used exactly as given for decoration (rings, tints, chart series), but
//     the colour used for text and for buttons with white lettering ("bronze") is the accent
//     darkened only as far as it must be to reach 4.5:1 contrast. A light rose-gold or silver cannot
//     carry text as it is.
//   - Success, warning and error colours never change, so green still means "done" in every theme.

export const PALETTE_IDS = [
  "aubergine",
  "emerald",
  "terracotta",
  "indigo",
  "fig",
  "charcoal",
  "kumkum",
  "neelambari",
  "haldi",
  "gulab",
  "jamdani",
  "kashi",
] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
export const DEFAULT_PALETTE: PaletteId = "aubergine";

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === "string" && (PALETTE_IDS as readonly string[]).includes(value);
}

// A stored or posted value that is not a palette (an old record, a typo) becomes the default.
export function toPaletteId(value: unknown): PaletteId {
  return isPaletteId(value) ? value : DEFAULT_PALETTE;
}

// ---- colour maths -----------------------------------------------------------------------------

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// `amount` of the way from `from` to `to` (0 = from, 1 = to).
export function mix(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex(a.map((v, i) => v + (b[i]! - v) * amount) as Rgb);
}

// WCAG relative luminance and contrast ratio (1 to 21).
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// The given colour, darkened step by step only until it reads at `min` contrast on every background.
export function darkenToContrast(hex: string, backgrounds: string[], min: number): string {
  for (let step = 0; step <= 50; step++) {
    const candidate = mix(hex, "#000000", step * 0.02);
    if (backgrounds.every((bg) => contrastRatio(candidate, bg) >= min)) return candidate;
  }
  return "#000000";
}

// ---- the palettes -----------------------------------------------------------------------------

export type PaletteGroup = "classic" | "heritage";

// How the picker sorts the palettes into sections, in the order they are shown.
export const PALETTE_GROUPS: { id: PaletteGroup; title: string; blurb: string }[] = [
  { id: "classic", title: "Classic", blurb: "Refined palettes in the spirit of modern software." },
  {
    id: "heritage",
    title: "Indian heritage",
    blurb: "Drawn from sindoor, silk, zari, haldi, rose attar, lime wash and sandstone.",
  },
];

export type PaletteDef = {
  id: PaletteId;
  group: PaletteGroup;
  name: string;
  vibe: string;
  // The four colours of the brief.
  primary: string;
  accent: string;
  canvas: string;
  surface: string;
  // Four colours that tell chart series apart, each readable against white.
  series: [string, string, string, string];
};

export const PALETTES: PaletteDef[] = [
  {
    id: "aubergine",
    group: "classic",
    name: "Royal Aubergine & Champagne Gold",
    vibe: "Grand palace weddings, heritage luxury, quiet dignity.",
    primary: "#2d1226",
    accent: "#c5a059",
    canvas: "#fff8f8",
    surface: "#f5eced",
    series: ["#7a3b6b", "#b8862b", "#3f7d52", "#c0506a"],
  },
  {
    id: "emerald",
    group: "classic",
    name: "Heritage Emerald & Antique Brass",
    vibe: "Courtyards and haveli stone, a timeless heirloom feel.",
    primary: "#122b24",
    accent: "#c29b48",
    canvas: "#faf8f4",
    surface: "#f0efe9",
    series: ["#2f6b5a", "#b8862b", "#8a4b3a", "#6b7fa3"],
  },
  {
    id: "terracotta",
    group: "classic",
    name: "Terracotta & Roasted Chestnut",
    vibe: "Warm and earthy, sacred wood and clay, intimate celebrations.",
    primary: "#331812",
    accent: "#b85d36",
    canvas: "#fdf9f5",
    surface: "#f6ece3",
    series: ["#8a3f26", "#b8862b", "#4f8a5f", "#5a5a9a"],
  },
  {
    id: "indigo",
    group: "classic",
    name: "Midnight Indigo & Moonlit Silver",
    vibe: "Crisp and modern, evening pheras under starlight.",
    primary: "#141a29",
    accent: "#758aa6",
    canvas: "#f8fafc",
    surface: "#eef2f6",
    series: ["#3d4f7a", "#b8862b", "#5a8a3c", "#b0566b"],
  },
  {
    id: "fig",
    group: "classic",
    name: "Fig & Spiced Cardamom",
    vibe: "Boutique and artisanal, understated organic luxury.",
    primary: "#24141e",
    accent: "#7c7e4f",
    canvas: "#faf7f5",
    surface: "#f0ebe6",
    series: ["#6e3a5c", "#7c7e4f", "#b07a2c", "#4a7a8a"],
  },
  {
    id: "charcoal",
    group: "classic",
    name: "Royal Charcoal & Rose Gold",
    vibe: "Minimal and editorial, a single blush undertone.",
    primary: "#1a181b",
    accent: "#b98579",
    canvas: "#fbf9f8",
    surface: "#f2eceb",
    series: ["#4a464c", "#a8695b", "#5f8767", "#6a7aa3"],
  },
  {
    id: "kumkum",
    group: "heritage",
    name: "Kumkum Sindoor & Basra Pearl",
    vibe: "Deeply traditional and auspicious, reimagined as a high-fashion editorial house.",
    primary: "#3e121a",
    accent: "#cca358",
    canvas: "#fdfbf9",
    surface: "#f7efe9",
    series: ["#8a2f3d", "#b8862b", "#3f7d6b", "#5a5a9a"],
  },
  {
    id: "neelambari",
    group: "heritage",
    name: "Neelambari & Raw Zari",
    vibe: "Majestic and serene, like temple corridors at dusk.",
    primary: "#0e1e28",
    accent: "#bfa15f",
    canvas: "#f9f8f5",
    surface: "#eef2f3",
    series: ["#1d5a6e", "#a8872f", "#8a4b6b", "#5a8a4f"],
  },
  {
    id: "haldi",
    group: "heritage",
    name: "Haldi & Sheesham Wood",
    vibe: "Warm, welcoming and celebratory; tactile and organic.",
    primary: "#2b1b17",
    accent: "#d9a75e",
    canvas: "#fcfaf7",
    surface: "#f4ece3",
    series: ["#8a4a2a", "#b5782a", "#4f7a63", "#6a5a9a"],
  },
  {
    id: "gulab",
    group: "heritage",
    name: "Gulab Attar & Pistachio Pista",
    vibe: "Poetic, soft and contemporary: courtyard breakfasts and scented waters.",
    primary: "#291820",
    accent: "#ad6873",
    canvas: "#fbf8f8",
    surface: "#f0f3ef",
    series: ["#8a4a56", "#657d6a", "#b07a2c", "#7a5a9a"],
  },
  {
    id: "jamdani",
    group: "heritage",
    name: "Jamdani Indigo & Chalk Chuna",
    vibe: "Sharp, editorial and architectural, like a design-studio monograph.",
    primary: "#131b2e",
    accent: "#979e9f",
    canvas: "#f8fafc",
    surface: "#eef1f5",
    series: ["#2e4a7a", "#7a8a8c", "#b0566b", "#4f8a5f"],
  },
  {
    id: "kashi",
    group: "heritage",
    name: "Kashi Sandstone & Marigold Thread",
    vibe: "Timeless, sacred and monumental, with warm sunlight and quiet distinction.",
    primary: "#221e1f",
    accent: "#d49339",
    canvas: "#faf7f2",
    surface: "#f2eae0",
    series: ["#8a3f2c", "#b07a2c", "#4a6a8a", "#5a8a3c"],
  },
];

export function getPalette(id: PaletteId): PaletteDef {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;
}

// Every colour the app paints with that a palette changes, by CSS variable.
export type PaletteTokens = Record<string, string>;

const WHITE = "#ffffff";
const BLACK = "#000000";

// The default palette is exactly what the stylesheet already says, so choosing it (or never
// choosing) changes nothing. A test keeps this in step with globals.css.
const AUBERGINE_TOKENS: PaletteTokens = {
  "--color-canvas": "#fdfbf7",
  "--color-warm": "#faf7f2",
  "--color-sand": "#f8f5ee",
  "--color-blush": "#fff8f8",
  "--color-rose-50": "#fbf1f2",
  "--color-rose-100": "#f5eced",
  "--color-rose-200": "#efe6e7",
  "--color-rose-300": "#e9e0e1",
  "--color-ink": "#1e1b1c",
  "--color-ink-2": "#4e4449",
  "--color-line": "#e8e2d8",
  "--color-line-soft": "#d1c3c9",
  "--color-plum": "#2d1226",
  "--color-plum-hover": "#3c1b33",
  "--color-bronze": "#775a19",
  "--color-amber-ink": "#846927",
  "--color-amber-deep": "#261900",
  "--color-honey": "#ffdea5",
  "--color-gold": "#e5c378",
  "--color-gold-ring": "#c5a059",
  "--color-gold-soft": "#fed488",
  "--background": "#fdfbf7",
  "--foreground": "#1e1b1c",
  "--primary": "#2d1226",
  "--secondary": "#f5eced",
  "--secondary-foreground": "#1e1b1c",
  "--muted": "#f5eced",
  "--muted-foreground": "#4e4449",
  "--accent": "#fbf1f2",
  "--accent-foreground": "#1e1b1c",
  "--border": "#e8e2d8",
  "--input": "#e8e2d8",
  "--ring": "#2d1226",
  "--chart-1": "#2d1226",
  "--chart-2": "#c5a059",
  "--chart-3": "#775a19",
  "--chart-4": "#e9e0e1",
  "--sidebar": "#f8f5ee",
  "--sidebar-foreground": "#1e1b1c",
  "--sidebar-primary": "#2d1226",
  "--sidebar-accent": "#f5eced",
  "--sidebar-accent-foreground": "#1e1b1c",
  "--sidebar-border": "#e8e2d8",
  "--sidebar-ring": "#2d1226",
};

function deriveTokens(p: PaletteDef): PaletteTokens {
  const { primary, accent, canvas, surface } = p;
  const ink = mix(primary, BLACK, 0.3);
  const rose50 = mix(canvas, surface, 0.5);
  const rose200 = mix(surface, ink, 0.04);
  const rose300 = mix(surface, ink, 0.08);
  const honey = mix(accent, WHITE, 0.72);
  // Text and white-lettered buttons: dark enough on white, the canvas, the surface and the honey tint.
  const bronze = darkenToContrast(accent, [WHITE, canvas, surface, honey], 4.5);
  // The soft highlight carries bronze lettering, so it is made light enough for that, rather than
  // making the accent darker than it needs to be (which would flatten a light metallic like silver).
  let goldSoft = mix(accent, WHITE, 0.45);
  for (let t = 0.45; t <= 0.9 && contrastRatio(bronze, goldSoft) < 4.5; t += 0.05)
    goldSoft = mix(accent, WHITE, t);
  const ink2 = darkenToContrast(mix(ink, canvas, 0.28), [WHITE, canvas, surface, rose50], 4.5);
  const line = mix(surface, ink, 0.1);
  const sand = mix(canvas, surface, 0.5);
  return {
    "--color-canvas": canvas,
    "--color-warm": mix(canvas, surface, 0.25),
    "--color-sand": sand,
    "--color-blush": canvas,
    "--color-rose-50": rose50,
    "--color-rose-100": surface,
    "--color-rose-200": rose200,
    "--color-rose-300": rose300,
    "--color-ink": ink,
    "--color-ink-2": ink2,
    "--color-line": line,
    "--color-line-soft": mix(surface, ink, 0.2),
    "--color-plum": primary,
    "--color-plum-hover": mix(primary, WHITE, 0.12),
    "--color-bronze": bronze,
    "--color-amber-ink": mix(bronze, WHITE, 0.12),
    "--color-amber-deep": mix(bronze, BLACK, 0.8),
    "--color-honey": honey,
    "--color-gold": mix(accent, WHITE, 0.3),
    "--color-gold-ring": accent,
    "--color-gold-soft": goldSoft,
    "--background": canvas,
    "--foreground": ink,
    "--primary": primary,
    "--secondary": surface,
    "--secondary-foreground": ink,
    "--muted": surface,
    "--muted-foreground": ink2,
    "--accent": rose50,
    "--accent-foreground": ink,
    "--border": line,
    "--input": line,
    "--ring": primary,
    "--chart-1": primary,
    "--chart-2": accent,
    "--chart-3": bronze,
    "--chart-4": rose300,
    "--sidebar": sand,
    "--sidebar-foreground": ink,
    "--sidebar-primary": primary,
    "--sidebar-accent": surface,
    "--sidebar-accent-foreground": ink,
    "--sidebar-border": line,
    "--sidebar-ring": primary,
  };
}

// All the variables for a palette (the default's are the stylesheet's own).
export function paletteTokens(id: PaletteId): PaletteTokens {
  return id === DEFAULT_PALETTE ? { ...AUBERGINE_TOKENS } : deriveTokens(getPalette(id));
}

// The inline style that recolours everything inside an element. The default adds nothing, since the
// stylesheet already is the default.
export function paletteStyle(id: PaletteId): CSSProperties {
  return id === DEFAULT_PALETTE ? {} : (paletteTokens(id) as CSSProperties);
}

// Literal series colours for charts, which are exported as pictures and cannot use CSS variables.
export function chartSeries(id: PaletteId): [string, string, string, string] {
  return getPalette(id).series;
}

// Everything a chart paints with, as literal colours: its series, its lettering and its grid lines.
export type ChartTheme = {
  series: [string, string, string, string];
  ink: string; // titles and legends
  muted: string; // axis labels and descriptions
  grid: string;
};

export function chartTheme(id: PaletteId): ChartTheme {
  const t = paletteTokens(id);
  return {
    series: chartSeries(id),
    ink: t["--color-plum"]!,
    muted: t["--color-ink-2"]!,
    // The default keeps the grid colour it always had.
    grid: id === DEFAULT_PALETTE ? "#eadfe0" : t["--color-rose-300"]!,
  };
}
