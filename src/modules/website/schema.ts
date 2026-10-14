import { z } from "zod";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { isValidSlug, SLUG_MAX, SLUG_MIN } from "@/lib/slug";
import { parseYouTube } from "@/lib/youtube";
import { THEMES, type Theme, type WebsiteContent } from "@/modules/wedding/schema";
import { FONT_PAIR_IDS, HERO_IDS, MOTIF_IDS, PALETTE_IDS, type Design } from "@/themes/kit";

// Zod schemas and types for the website module (PRD 5.9, 5.11).

export const THEME_INFO: Record<Theme, { name: string; feel: string }> = {
  classical: {
    name: "Classical Indian",
    feel: "Reds and golds, traditional motifs and ornate serif type.",
  },
  minimal: {
    name: "Minimal Elegant",
    feel: "Soft neutrals, generous white space and refined type.",
  },
  modern: {
    name: "Modern Celebration",
    feel: "Bright colours, bold type and a playful layout.",
  },
};

// Blank removes the link. Anything else must be a YouTube watch, live or youtu.be link.
const youtubeUrlField = z
  .string()
  .trim()
  .max(300, "That link is too long")
  .transform((value, ctx) => {
    if (!value) return null;
    const parsed = parseYouTube(value);
    if (!parsed) {
      ctx.addIssue({
        code: "custom",
        message: "Paste a YouTube link: youtube.com/watch, youtube.com/live or youtu.be",
      });
      return z.NEVER;
    }
    return parsed.watchUrl;
  });

export const websiteSettingsSchema = z.object({
  isOn: z.boolean(),
  theme: z.enum(THEMES),
  // The part of the address after the domain: lowercase letters, numbers and hyphens.
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value.length >= SLUG_MIN && value.length <= SLUG_MAX, {
      message: `Use ${SLUG_MIN} to ${SLUG_MAX} characters`,
    })
    .refine((value) => isValidSlug(value) || value.length < SLUG_MIN || value.length > SLUG_MAX, {
      message: "Use only lowercase letters, numbers and single hyphens",
    })
    .refine((value) => !isReservedSlug(value), {
      message: "That address is reserved. Try another.",
    }),
  showLive: z.boolean(),
  // Adds a "Photo gallery" section that links to the private gallery.
  showGallery: z.boolean().default(false),
  youtubeUrl: youtubeUrlField,
});
export type WebsiteSettingsInput = z.output<typeof websiteSettingsSchema>;
export type WebsiteSettingsFormValues = z.input<typeof websiteSettingsSchema>;

// What the public website shows. Built from the wedding's own data and nothing else: no guests,
// no money, no members.
export type SiteEvent = {
  id: string;
  name: string;
  date: Date;
  startTime: string;
  endTime?: string;
  dressCode?: string;
  venueName?: string;
  address?: string;
  mapsUrl: string | null;
  // The event's own picture, if it has one.
  coverUrl?: string;
};

export type SiteData = {
  slug: string;
  theme: Theme;
  brideName: string;
  groomName: string;
  date: Date;
  city: string;
  welcome?: string;
  // The wedding's cover picture, shown above the names.
  coverUrl?: string;
  events: SiteEvent[];
  // Present when the Live section is on and a link is set.
  live?: { embedUrl: string; watchUrl: string };
  // Present when the Photo gallery section is on: the private gallery link.
  galleryUrl?: string;
  // The look: the AI's choice from the design kit, or the theme's preset.
  design: Design;
  // Words written with AI. Each part shows only when present.
  content?: SiteContent;
  isPreview: boolean;
};

// The Live stream page: just the switch and the link. Turning the section on needs a link to show.
export const liveSettingsSchema = z
  .object({ showLive: z.boolean(), youtubeUrl: youtubeUrlField })
  .refine((v) => !v.showLive || v.youtubeUrl !== null, {
    message: "Paste your YouTube link to show the live section",
    path: ["youtubeUrl"],
  });
export type LiveSettingsInput = z.output<typeof liveSettingsSchema>;
export type LiveSettingsFormValues = z.input<typeof liveSettingsSchema>;

// ---- Writing the website with AI ----

const text = (max: number) => z.string().trim().min(1).max(max);

// What the AI hands back: a design from the kit and the words. Every field is present (some may be
// null) so both providers can enforce it strictly; the limits are checked here, after the answer
// arrives.
export const siteDraftSchema = z.object({
  design: z.object({
    palette: z.enum(PALETTE_IDS),
    fonts: z.enum(FONT_PAIR_IDS),
    hero: z.enum(HERO_IDS),
    motif: z.enum(MOTIF_IDS),
  }),
  tagline: text(120),
  welcome: text(800),
  story: z.object({ title: text(60), body: text(1500) }).nullable(),
  eventsTitle: text(40),
  venuesTitle: text(40),
  faqs: z.array(z.object({ q: text(150), a: text(400) })).max(8),
  closingNote: text(300).nullable(),
});
export type SiteDraft = z.output<typeof siteDraftSchema>;

// The same shape as a plain JSON schema for the providers (no lengths: not every provider enforces
// those, so Zod does).
const str = { type: "string" } as const;
const oneOf = (values: readonly string[]) => ({ type: "string", enum: [...values] });
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
export const siteDraftJsonSchema: Record<string, unknown> = obj({
  design: obj({
    palette: oneOf(PALETTE_IDS),
    fonts: oneOf(FONT_PAIR_IDS),
    hero: oneOf(HERO_IDS),
    motif: oneOf(MOTIF_IDS),
  }),
  tagline: str,
  welcome: str,
  story: { anyOf: [obj({ title: str, body: str }), { type: "null" }] },
  eventsTitle: str,
  venuesTitle: str,
  faqs: { type: "array", items: obj({ q: str, a: str }) },
  closingNote: { anyOf: [str, { type: "null" }] },
});

// What is kept on the wedding and shown on the site.
export type SiteContent = WebsiteContent;

export function draftToContent(draft: SiteDraft): SiteContent {
  const { story, closingNote } = draft;
  return {
    design: draft.design,
    tagline: draft.tagline,
    welcome: draft.welcome,
    eventsTitle: draft.eventsTitle,
    venuesTitle: draft.venuesTitle,
    faqs: draft.faqs,
    ...(story ? { story } : {}),
    ...(closingNote ? { closingNote } : {}),
  };
}

// ---- The couple's brief: what they tell us about the site they want ----

export const VIBES = {
  royal: "Royal",
  traditional: "Traditional",
  romantic: "Romantic",
  minimal: "Minimal",
  modern: "Modern",
  fun: "Fun & colourful",
  boho: "Garden & boho",
  beach: "Beach",
} as const;
export const TONES = {
  warm: "Warm",
  formal: "Formal",
  playful: "Playful",
  poetic: "Poetic",
} as const;
export const LANGUAGES = {
  english: "English",
  hinglish: "Hinglish",
} as const;

const keys = <T extends object>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).default("");

export const siteBriefSchema = z
  .object({
    vibes: z
      .array(z.enum(keys(VIBES)))
      .max(3, "Pick up to 3")
      .default([]),
    colours: optionalText(80, "Keep the colours short"),
    tone: z.enum(keys(TONES)).nullable().default(null),
    language: z.enum(keys(LANGUAGES)).default("english"),
    howWeMet: optionalText(600, "Keep it under 600 characters"),
    extra: optionalText(600, "Keep it under 600 characters"),
    // On "Try another": the draft the couple just saw, so the next one can be clearly different.
    previous: z
      .object({ design: siteDraftSchema.shape.design, tagline: z.string().trim().max(120) })
      .nullable()
      .default(null),
  })
  .refine((b) => b.vibes.length > 0 || b.colours || b.howWeMet || b.extra.length >= 10, {
    message: "Pick a vibe or tell us a little about the website you want",
  });
export type SiteBrief = z.output<typeof siteBriefSchema>;
export type SiteBriefInput = z.input<typeof siteBriefSchema>;
