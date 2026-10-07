"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { getWedding } from "@/modules/wedding/service";
import { liveSettingsSchema, websiteSettingsSchema } from "./schema";
import { saveLiveSettings, saveWebsiteSettings } from "./service";

// Settings for the wedding website. Open to Admins and Managers. The wedding always comes from the
// signed-in member. The old address is refreshed too, so a changed address stops serving the site.
export async function saveWebsiteSettingsAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
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
    const ctx = await requireMember();
    const parsed = liveSettingsSchema.parse(input);
    await saveLiveSettings(ctx.weddingId, parsed);
    const wedding = await getWedding(ctx.weddingId);
    if (wedding) revalidatePath(`/${wedding.website.slug}`);
    revalidatePath("/live");
    revalidatePath("/website");
    return { showLive: parsed.showLive };
  });
}
