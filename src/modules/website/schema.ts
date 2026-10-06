import { z } from "zod";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { isValidSlug, SLUG_MAX, SLUG_MIN } from "@/lib/slug";
import { parseYouTube } from "@/lib/youtube";
import { THEMES, type Theme } from "@/modules/wedding/schema";

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
  // Blank removes the link. Anything else must be a YouTube watch, live or youtu.be link.
  youtubeUrl: z
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
    }),
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
};

export type SiteData = {
  slug: string;
  theme: Theme;
  brideName: string;
  groomName: string;
  date: Date;
  city: string;
  welcome?: string;
  events: SiteEvent[];
  // Present when the Live section is on and a link is set.
  live?: { embedUrl: string; watchUrl: string };
  // Present when the Photo gallery section is on: the private gallery link.
  galleryUrl?: string;
  isPreview: boolean;
};
