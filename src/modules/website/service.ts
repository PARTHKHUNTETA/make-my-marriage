import { parseYouTube } from "@/lib/youtube";
import { mapsUrl } from "@/lib/maps";
import { listEvents } from "@/modules/events/service";
import type { WeddingSummary } from "@/modules/wedding/schema";
import { getWedding, getWeddingBySlug, updateWebsite } from "@/modules/wedding/service";
import type { SiteData, WebsiteSettingsInput } from "./schema";

// Business rules for the website module (PRD 5.9, 5.11). The public site is built only from a
// wedding's details, its events marked "show on website", and its live link.

async function buildSite(wedding: WeddingSummary, isPreview: boolean): Promise<SiteData> {
  const events = (await listEvents(wedding.id)).filter((e) => e.showOnWebsite);
  const live =
    wedding.website.showLive && wedding.website.youtubeUrl
      ? parseYouTube(wedding.website.youtubeUrl)
      : null;
  return {
    slug: wedding.website.slug,
    theme: wedding.website.theme,
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    date: wedding.date,
    city: wedding.city,
    welcome: wedding.description,
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      dressCode: e.dressCode,
      venueName: e.venueName,
      address: e.address,
      mapsUrl: mapsUrl(e.venueName, e.address),
    })),
    live: live ? { embedUrl: live.embedUrl, watchUrl: live.watchUrl } : undefined,
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

export async function saveWebsiteSettings(
  weddingId: string,
  input: WebsiteSettingsInput,
): Promise<void> {
  await updateWebsite(weddingId, {
    slug: input.slug,
    theme: input.theme,
    isOn: input.isOn,
    showLive: input.showLive,
    youtubeUrl: input.youtubeUrl,
  });
}
