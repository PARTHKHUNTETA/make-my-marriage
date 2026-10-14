import type { Theme } from "@/modules/wedding/schema";

// The design kit for wedding websites. A site's look is four choices: a colour palette, a font
// pairing, a hero layout and a decorative motif. The three themes are presets of these, and the AI
// picks its own combination when it writes a site. Every option here is hand-made and checked for
// contrast (kit.test.ts), so any combination looks finished.

export type Palette = {
  label: string;
  // For the AI: what the palette suits.
  mood: string;
  bg: string; // page background
  surface: string; // cards and panels
  ink: string; // body text
  heading: string; // section headings and names on the page
  accent: string; // ornaments, rules and small details (decorative only)
  heroBg: string; // the hero's background, any CSS background value
  heroSolid: string; // the hero's main colour, used to check contrast
  heroInk: string; // text on the hero
  heroAccent: string; // ornaments and the ampersand on the hero
};

export const PALETTES = {
  "royal-maroon": {
    label: "Royal maroon & gold",
    mood: "Rajasthani royalty, heritage palaces, traditional wedding red",
    bg: "#fbf4e6",
    surface: "#fffaf0",
    ink: "#3b1a14",
    heading: "#7a1424",
    accent: "#c9a227",
    heroBg: "radial-gradient(ellipse at top, #8a1a2c 0%, #5e0d1b 70%)",
    heroSolid: "#6d0f1f",
    heroInk: "#f8e7c0",
    heroAccent: "#e2b85a",
  },
  "marigold-sunset": {
    label: "Marigold & saffron",
    mood: "haldi, mehendi, daytime festivities, warm and sunny",
    bg: "#fff7ea",
    surface: "#fffdf7",
    ink: "#3a2208",
    heading: "#9a3b0c",
    accent: "#e8a33d",
    heroBg: "linear-gradient(160deg, #b4430f 0%, #8f2f08 100%)",
    heroSolid: "#a3390c",
    heroInk: "#fff3dc",
    heroAccent: "#ffd27a",
  },
  "emerald-gold": {
    label: "Emerald & antique gold",
    mood: "Mughal gardens, regal but calm, evening weddings",
    bg: "#f6f3ea",
    surface: "#fffdf6",
    ink: "#1d2b24",
    heading: "#1f4d3a",
    accent: "#b8932f",
    heroBg: "radial-gradient(ellipse at top, #1d4a37 0%, #10291f 75%)",
    heroSolid: "#143528",
    heroInk: "#f3e7c4",
    heroAccent: "#d4b25a",
  },
  "jodhpur-blue": {
    label: "Indigo & brass",
    mood: "Jodhpur blue city, night skies, elegant and cool",
    bg: "#f3f6fb",
    surface: "#ffffff",
    ink: "#18233b",
    heading: "#1d3a6e",
    accent: "#c58b2b",
    heroBg: "linear-gradient(170deg, #1f3c70 0%, #12264a 100%)",
    heroSolid: "#1b3563",
    heroInk: "#eef3ff",
    heroAccent: "#f0c36a",
  },
  "plum-rose": {
    label: "Plum & rose",
    mood: "romantic, sangeet nights, rich jewel tones",
    bg: "#faf3f6",
    surface: "#fffafc",
    ink: "#2e1a27",
    heading: "#5b2147",
    accent: "#d68fae",
    heroBg: "radial-gradient(ellipse at top, #5c2149 0%, #3a1230 75%)",
    heroSolid: "#4a1a3a",
    heroInk: "#fbe8f1",
    heroAccent: "#f1a7c6",
  },
  "blush-pastel": {
    label: "Blush pastel",
    mood: "soft, dreamy, day weddings, modern brides, pastel lehengas",
    bg: "#fdf6f4",
    surface: "#ffffff",
    ink: "#3d2b2e",
    heading: "#8f3f50",
    accent: "#e8a6a1",
    heroBg: "linear-gradient(180deg, #f8e4df 0%, #f3d3cf 100%)",
    heroSolid: "#f6dfdb",
    heroInk: "#4a2a31",
    heroAccent: "#b5636f",
  },
  "sage-ivory": {
    label: "Sage & ivory",
    mood: "garden, boho, outdoor, earthy and fresh",
    bg: "#f7f6f0",
    surface: "#ffffff",
    ink: "#2b3029",
    heading: "#3f5a3b",
    accent: "#9bb59a",
    heroBg: "linear-gradient(180deg, #e9eee2 0%, #dde5d4 100%)",
    heroSolid: "#e3e9da",
    heroInk: "#253023",
    heroAccent: "#6f8b6b",
  },
  "ivory-minimal": {
    label: "Ivory & charcoal",
    mood: "minimal, understated, modern-classic, black-tie",
    bg: "#faf8f5",
    surface: "#ffffff",
    ink: "#2b2a28",
    heading: "#2b2a28",
    accent: "#b3ab9e",
    heroBg: "#f3efe8",
    heroSolid: "#f3efe8",
    heroInk: "#2b2a28",
    heroAccent: "#8a857d",
  },
  "teal-coral": {
    label: "Teal & coral",
    mood: "Goa, Kerala, beach and backwater weddings, breezy",
    bg: "#f2f8f7",
    surface: "#ffffff",
    ink: "#12313a",
    heading: "#0f4c5c",
    accent: "#e9806e",
    heroBg: "linear-gradient(165deg, #12586a 0%, #0b3a47 100%)",
    heroSolid: "#0f4c5c",
    heroInk: "#eaf7f5",
    heroAccent: "#ffb4a2",
  },
  "festive-pink": {
    label: "Rani pink & orange",
    mood: "bold, fun, colourful, big party energy",
    bg: "#fff4fb",
    surface: "#ffffff",
    ink: "#1d1340",
    heading: "#b0124f",
    accent: "#ffb020",
    heroBg: "linear-gradient(135deg, #d0125c 0%, #c8321f 60%, #b04d08 100%)",
    heroSolid: "#c41a4a",
    heroInk: "#ffffff",
    heroAccent: "#ffe08a",
  },
} as const satisfies Record<string, Palette>;
export type PaletteId = keyof typeof PALETTES;

// Font pairings. The font names are CSS variables set up in fonts.ts.
export type FontPair = {
  label: string;
  mood: string;
  names: string; // the couple's names in the hero
  heading: string; // section headings
  body: string; // everything else
  // Extra classes for the names, headings and body text (some faces want caps, a lighter weight
  // or a larger size to read comfortably).
  namesClass: string;
  headingClass: string;
  bodyClass: string;
};

export const FONT_PAIRS = {
  royal: {
    label: "Cinzel & Cormorant",
    mood: "regal, engraved capitals, palace invitations",
    names: "var(--font-cinzel)",
    heading: "var(--font-cinzel)",
    body: "var(--font-cormorant)",
    namesClass: "font-semibold tracking-wide",
    headingClass: "font-semibold tracking-[0.08em] uppercase",
    bodyClass: "text-[19px]",
  },
  romantic: {
    label: "Great Vibes script with Cormorant",
    mood: "romantic, handwritten names, classic invitation card",
    names: "var(--font-great-vibes)",
    heading: "var(--font-cormorant)",
    body: "var(--font-lato)",
    namesClass: "font-normal",
    headingClass: "font-semibold",
    bodyClass: "text-[17px]",
  },
  editorial: {
    label: "Playfair & Lato",
    mood: "elegant magazine feel, refined and timeless",
    names: "var(--font-playfair)",
    heading: "var(--font-playfair)",
    body: "var(--font-lato)",
    namesClass: "font-normal italic",
    headingClass: "font-normal",
    bodyClass: "text-[17px]",
  },
  heritage: {
    label: "Marcellus & Lora",
    mood: "traditional, warm, temple and heritage feel",
    names: "var(--font-marcellus)",
    heading: "var(--font-marcellus)",
    body: "var(--font-lora)",
    namesClass: "font-normal",
    headingClass: "font-normal tracking-wide",
    bodyClass: "text-[17px]",
  },
  modern: {
    label: "Montserrat & DM Sans",
    mood: "clean, contemporary, city weddings",
    names: "var(--font-montserrat)",
    heading: "var(--font-montserrat)",
    body: "var(--font-dm-sans)",
    namesClass: "font-extrabold uppercase tracking-tight",
    headingClass: "font-bold uppercase tracking-[0.12em]",
    bodyClass: "text-[16px]",
  },
  playful: {
    label: "Yeseva & Nunito",
    mood: "fun, friendly, festive and bold",
    names: "var(--font-yeseva)",
    heading: "var(--font-yeseva)",
    body: "var(--font-nunito)",
    namesClass: "font-normal",
    headingClass: "font-normal",
    bodyClass: "text-[17px]",
  },
} as const satisfies Record<string, FontPair>;
export type FontPairId = keyof typeof FONT_PAIRS;

export const HEROES = {
  classic: "Names centred on the coloured hero, framed by the motif. Works for every wedding.",
  arch: "Names inside a tall temple-style arch, with the cover photo in the arch when there is one. Traditional and grand.",
  monogram: "A large monogram of the couple's initials above their names. Elegant and minimal.",
  photo:
    "The cover photo fills the hero with the names over it. Only when the wedding has a cover photo; otherwise it shows as classic.",
} as const;
export type HeroId = keyof typeof HEROES;

export const MOTIFS = {
  mandala: "A fine mandala: traditional, spiritual, suits most weddings.",
  marigold: "Strings of marigold flowers: haldi, mehendi, festive and warm.",
  toran: "A hanging toran of mango leaves and bells: auspicious, traditional doorway feel.",
  lotus: "Lotus flowers: graceful, calm, South Indian and temple weddings.",
  none: "No ornaments: clean and minimal.",
} as const;
export type MotifId = keyof typeof MOTIFS;

export type Design = { palette: PaletteId; fonts: FontPairId; hero: HeroId; motif: MotifId };

export const PALETTE_IDS = Object.keys(PALETTES) as [PaletteId, ...PaletteId[]];
export const FONT_PAIR_IDS = Object.keys(FONT_PAIRS) as [FontPairId, ...FontPairId[]];
export const HERO_IDS = Object.keys(HEROES) as [HeroId, ...HeroId[]];
export const MOTIF_IDS = Object.keys(MOTIFS) as [MotifId, ...MotifId[]];

// The three themes the couple can pick by hand.
export const THEME_PRESETS: Record<Theme, Design> = {
  classical: { palette: "royal-maroon", fonts: "royal", hero: "arch", motif: "mandala" },
  minimal: { palette: "ivory-minimal", fonts: "editorial", hero: "monogram", motif: "none" },
  modern: { palette: "festive-pink", fonts: "modern", hero: "classic", motif: "marigold" },
};
