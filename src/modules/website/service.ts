import { parseYouTube } from "@/lib/youtube";
import { mapsUrl } from "@/lib/maps";
import { listEvents } from "@/modules/events/service";
import type { WeddingSummary } from "@/modules/wedding/schema";
import { absoluteUrl } from "@/lib/app-url";
import { coverUrl } from "@/modules/photos/covers";
import { generateStructured, type AiProvider } from "@/lib/ai";
import { THEME_PRESETS } from "@/themes/kit";
import { AppError } from "@/lib/errors";
import {
  getGallerySettings,
  getWedding,
  getWeddingBySlug,
  updateWebsite,
  updateWebsiteContent,
} from "@/modules/wedding/service";
import { buildSitePrompt, SITE_SYSTEM_PROMPT } from "./prompt";
import {
  draftToContent,
  siteDraftJsonSchema,
  siteDraftSchema,
  type LiveSettingsInput,
  type SiteBrief,
  type SiteData,
  type SiteDraft,
  type WebsiteSettingsInput,
} from "./schema";

// Business rules for the website module (PRD 5.9, 5.11). The public site is built only from a
// wedding's details, its events marked "show on website", and its live link.

async function buildSite(wedding: WeddingSummary, isPreview: boolean): Promise<SiteData> {
  const events = (await listEvents(wedding.id)).filter((e) => e.showOnWebsite);
  const live =
    wedding.website.showLive && wedding.website.youtubeUrl
      ? parseYouTube(wedding.website.youtubeUrl)
      : null;
  const galleryUrl = wedding.website.showGallery
    ? absoluteUrl(`/g/${(await getGallerySettings(wedding.id)).token}`)
    : undefined;
  return {
    slug: wedding.website.slug,
    theme: wedding.website.theme,
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    date: wedding.date,
    city: wedding.city,
    welcome: wedding.website.content?.welcome ?? wedding.description,
    coverUrl: await coverUrl(wedding.coverImageKey),
    events: await Promise.all(
      events.map(async (e) => ({
        id: e.id,
        name: e.name,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        dressCode: e.dressCode,
        venueName: e.venueName,
        address: e.address,
        mapsUrl: mapsUrl(e.venueName, e.address),
        coverUrl: await coverUrl(e.coverImageKey),
      })),
    ),
    live: live ? { embedUrl: live.embedUrl, watchUrl: live.watchUrl } : undefined,
    galleryUrl,
    design: wedding.website.content?.design ?? THEME_PRESETS[wedding.website.theme],
    content: wedding.website.content,
    isPreview,
  };
}

// The site at a public address. Null (a plain 404) when there is no such wedding or its website is
// off: a hidden site looks the same as one that never existed.
export async function getPublicSite(slug: string): Promise<SiteData | null> {
  const wedding = await getWeddingBySlug(slug);
  if (!wedding || !wedding.website.isOn) return null;
  return buildSite(wedding, false);
}

// The same site for the couple to look at before sharing, whether or not it is switched on.
export async function getSitePreview(weddingId: string): Promise<SiteData | null> {
  const wedding = await getWedding(weddingId);
  return wedding ? buildSite(wedding, true) : null;
}

// Picking a different theme by hand replaces an AI-chosen design, so the chosen theme shows; the
// AI-written words stay.
export async function saveWebsiteSettings(
  weddingId: string,
  input: WebsiteSettingsInput,
): Promise<void> {
  const before = await getWedding(weddingId);
  const clearDesign =
    Boolean(before?.website.content?.design) && before?.website.theme !== input.theme;
  await updateWebsite(weddingId, {
    ...(clearDesign ? { clearDesign: true } : {}),
    slug: input.slug,
    theme: input.theme,
    isOn: input.isOn,
    showLive: input.showLive,
    showGallery: input.showGallery,
    youtubeUrl: input.youtubeUrl,
  });
}

// Changes only the live stream (the switch and the link), leaving every other website setting alone.
export async function saveLiveSettings(weddingId: string, input: LiveSettingsInput): Promise<void> {
  await updateWebsite(weddingId, { showLive: input.showLive, youtubeUrl: input.youtubeUrl });
}

// Asks the AI for the website's design and words from the couple's brief and the wedding's own facts.
// Nothing is saved: the couple looks at the draft first and applies it if they like it.
export async function generateSiteDraft(
  weddingId: string,
  brief: SiteBrief,
): Promise<{ draft: SiteDraft; provider: AiProvider; tokens: number }> {
  const wedding = await getWedding(weddingId);
  if (!wedding) throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
  const events = (await listEvents(weddingId)).filter((e) => e.showOnWebsite);
  const user = buildSitePrompt(
    {
      brideName: wedding.brideName,
      groomName: wedding.groomName,
      title: wedding.title,
      date: wedding.date,
      city: wedding.city,
      venue: wedding.venue,
      welcome: wedding.description,
      hasCover: Boolean(wedding.coverImageKey),
      events: events.map((e) => ({
        name: e.name,
        type: e.type,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        venueName: e.venueName,
        address: e.address,
        dressCode: e.dressCode,
      })),
      hasLive: wedding.website.showLive && Boolean(wedding.website.youtubeUrl),
      hasGallery: wedding.website.showGallery,
    },
    brief,
  );
  const result = await generateStructured(siteDraftSchema, {
    system: SITE_SYSTEM_PROMPT,
    user,
    jsonSchema: siteDraftJsonSchema,
    name: "site_draft",
  });
  return {
    draft: result.value,
    provider: result.provider,
    tokens: result.inputTokens + result.outputTokens,
  };
}

// Keeps a draft the couple chose: its design and words. Null goes back to the plain theme.
export async function saveSiteContent(weddingId: string, draft: SiteDraft | null): Promise<void> {
  await updateWebsiteContent(weddingId, draft ? draftToContent(draft) : null);
}
