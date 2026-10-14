"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requirePermission } from "@/lib/authz";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { getWedding } from "@/modules/wedding/service";
import {
  liveSettingsSchema,
  siteBriefSchema,
  siteDraftSchema,
  websiteSettingsSchema,
} from "./schema";
import {
  generateSiteDraft,
  saveLiveSettings,
  saveSiteContent,
  saveWebsiteSettings,
} from "./service";

// Settings for the wedding website. Open to Admins and Managers. The wedding always comes from the
// signed-in member. The old address is refreshed too, so a changed address stops serving the site.
export async function saveWebsiteSettingsAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("wedding.update");
    const parsed = websiteSettingsSchema.parse(input);
    const before = await getWedding(ctx.weddingId);
    await saveWebsiteSettings(ctx.weddingId, parsed);
    if (before) revalidatePath(`/${before.website.slug}`);
    revalidatePath(`/${parsed.slug}`);
    revalidatePath("/", "layout");
    return { slug: parsed.slug };
  });
}

// The Live stream page. Open to Admins and Managers. Only the live settings change, so the website's
// address, theme and other sections are untouched, and the public page is refreshed straight away.
export async function saveLiveSettingsAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("wedding.update");
    const parsed = liveSettingsSchema.parse(input);
    await saveLiveSettings(ctx.weddingId, parsed);
    const wedding = await getWedding(ctx.weddingId);
    if (wedding) revalidatePath(`/${wedding.website.slug}`);
    revalidatePath("/live");
    revalidatePath("/website");
    return { showLive: parsed.showLive };
  });
}

// How many AI drafts one wedding may ask for in a day. Each costs money, and ten is plenty to try a
// few ideas.
const DRAFTS_PER_DAY = 10;

// Designs and writes a draft of the website from the couple's brief. Open to Admins and Managers. Nothing
// is saved until the couple applies it.
export async function generateSiteDraftAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("wedding.update");
    const brief = siteBriefSchema.parse(input);
    await consumeRateLimit("site_ai", subjectKey("wedding", ctx.weddingId), {
      limit: DRAFTS_PER_DAY,
      windowSeconds: 24 * 60 * 60,
    });
    const { draft, provider, tokens } = await generateSiteDraft(ctx.weddingId, brief);
    console.info(`[ai] site draft wedding=${ctx.weddingId} provider=${provider} tokens=${tokens}`);
    return { draft };
  });
}

// Applies a draft (its design and words) to the website, or with null goes back to the plain
// theme. Open to Admins and Managers. The draft is checked again here: it came back from the browser.
export async function saveSiteContentAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("wedding.update");
    const draft = input === null ? null : siteDraftSchema.parse(input);
    await saveSiteContent(ctx.weddingId, draft);
    const wedding = await getWedding(ctx.weddingId);
    if (wedding) revalidatePath(`/${wedding.website.slug}`);
    revalidatePath("/website");
    revalidatePath("/website/preview");
    return { applied: draft !== null };
  });
}
