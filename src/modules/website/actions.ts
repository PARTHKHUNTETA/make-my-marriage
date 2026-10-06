"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { getWedding } from "@/modules/wedding/service";
import { websiteSettingsSchema } from "./schema";
import { saveWebsiteSettings } from "./service";

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
