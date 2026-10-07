import "server-only";
import { cache } from "react";
import { MongoServerError } from "mongodb";
import { inTransaction } from "@/lib/db";
import { istDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { SLUG_MAX, SLUG_MIN, slugify } from "@/lib/slug";
import { generateToken } from "@/lib/tokens";
import { addAdminMember, getMembership } from "@/modules/members/service";
import {
  findWeddingById,
  insertWedding,
  findWeddingByGalleryToken,
  findWeddingBySlug,
  saveCoverImageKey,
  saveGalleryToken,
  saveUploadsOn,
  listWeddingsWithReminders,
  saveWebsiteSettings,
  type WebsiteChanges,
  saveOverallBudget,
  saveReminderSettings,
  saveSplitDefault,
  saveWhatsappMessage,
  updateWeddingDetails as saveWeddingDetails,
  type WeddingDoc,
} from "./repository";
import {
  DEFAULT_RSVP_REMINDER_DAYS,
  type CreateWeddingInput,
  type ReminderSettings,
  type UpdateWeddingInput,
  type WeddingSummary,
} from "./schema";

// Business rules for the wedding module.

const MAX_SLUG_ATTEMPTS = 10;

// "priya-weds-aarav", then "priya-weds-aarav-2", "-3", ... Reserved words are skipped.
export function slugCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base.slice(0, SLUG_MAX - 4)}-${attempt + 1}`.replace(/-+/g, "-");
}

function isDuplicateSlug(err: unknown): boolean {
  return (
    err instanceof MongoServerError &&
    err.code === 11000 &&
    (err.keyPattern?.["website.slug"] !== undefined || err.message.includes("website.slug"))
  );
}

// First-time setup: creates the wedding and makes its creator the admin, in one transaction so a
// failure can never leave a wedding without an admin or an admin without a wedding.
export async function createWedding(
  userId: string,
  input: CreateWeddingInput,
): Promise<{ weddingId: string }> {
  if (await getMembership(userId)) {
    throw new AppError("FORBIDDEN", "You already belong to a wedding.");
  }
  const date = istDate(input.date);
  if (!date) throw new AppError("VALIDATION_FAILED", "Enter a valid wedding date.");

  let base = slugify(input.title);
  if (base.length < SLUG_MIN) base = "wedding";

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = slugCandidate(base, attempt);
    if (isReservedSlug(slug)) continue;
    try {
      const weddingId = await inTransaction(async (session) => {
        const wedding = await insertWedding(
          {
            brideName: input.brideName,
            groomName: input.groomName,
            title: input.title,
            date,
            city: input.city,
            venue: input.venue,
            description: input.description,
            // Private until the couple turns the site on (PRD 5.9), and uploads start closed.
            website: { slug, theme: "minimal", isOn: false, showGallery: false, showLive: false },
            galleryToken: generateToken(),
            uploadsOn: false,
          },
          { session },
        );
        const id = wedding._id.toHexString();
        await addAdminMember({ userId, weddingId: id }, { session });
        return id;
      });
      return { weddingId };
    } catch (err) {
      if (isDuplicateSlug(err)) continue; // someone just took it; try the next suffix
      throw err;
    }
  }
  throw new AppError("INTERNAL", "We couldn't find a free web address. Please try again.");
}

function toSummary(doc: WeddingDoc): WeddingSummary {
  return {
    id: doc._id.toHexString(),
    brideName: doc.brideName,
    groomName: doc.groomName,
    title: doc.title,
    date: doc.date,
    city: doc.city,
    venue: doc.venue,
    description: doc.description,
    coverImageKey: doc.coverImageKey,
    slug: doc.website.slug,
    whatsappMessage: doc.whatsappMessage,
    reminders: doc.reminders ?? { enabled: false, rsvpDays: DEFAULT_RSVP_REMINDER_DAYS },
    website: {
      slug: doc.website.slug,
      theme: doc.website.theme,
      isOn: doc.website.isOn,
      showGallery: doc.website.showGallery,
      showLive: doc.website.showLive,
      youtubeUrl: doc.liveStream?.youtubeUrl,
    },
    overallBudget: doc.overallBudget,
    splitDefaults: doc.expenseSplitDefaults ?? {},
  };
}

// Looked up at most once per request, however many components ask for it.
export const getWedding = cache(async (weddingId: string): Promise<WeddingSummary | null> => {
  const doc = await findWeddingById(weddingId);
  return doc && !doc.deletedAt ? toSummary(doc) : null;
});

// Changes the couple's names, title, date, city, venue and welcome message. Both Admins and
// Managers may do this (PRD 3). The web address does not change when the title does: it is a
// link people may already have, and the couple edits it deliberately in the website settings.
export async function updateWeddingDetails(
  weddingId: string,
  input: UpdateWeddingInput,
): Promise<void> {
  const date = istDate(input.date);
  if (!date) throw new AppError("VALIDATION_FAILED", "Enter a valid wedding date.");
  const saved = await saveWeddingDetails(
    weddingId,
    {
      brideName: input.brideName,
      groomName: input.groomName,
      title: input.title,
      date,
      city: input.city,
      ...(input.venue ? { venue: input.venue } : {}),
      ...(input.description ? { description: input.description } : {}),
    },
    [
      ...(input.venue ? [] : (["venue"] as const)),
      ...(input.description ? [] : (["description"] as const)),
    ],
  );
  if (!saved) throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
}

// Saves the WhatsApp share message for the whole wedding. A blank message restores the default.
export async function setWhatsappMessage(weddingId: string, message: string): Promise<void> {
  const trimmed = message.trim();
  if (!(await saveWhatsappMessage(weddingId, trimmed || null)))
    throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
}

export async function setReminderSettings(
  weddingId: string,
  settings: ReminderSettings,
): Promise<void> {
  if (!(await saveReminderSettings(weddingId, settings)))
    throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
}

// For the daily reminder run: every wedding with reminders on, with what it needs.
export async function listRemindingWeddings(): Promise<
  Array<{ id: string; couple: string; reminders: ReminderSettings }>
> {
  return (await listWeddingsWithReminders()).map((w) => ({
    id: w._id.toHexString(),
    couple: `${w.brideName} & ${w.groomName}`,
    reminders: w.reminders ?? { enabled: false, rsvpDays: DEFAULT_RSVP_REMINDER_DAYS },
  }));
}

export async function setOverallBudget(weddingId: string, paise: number | null): Promise<void> {
  if (!(await saveOverallBudget(weddingId, paise)))
    throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
}

export async function setSplitDefault(
  weddingId: string,
  category: string,
  shares: { bride_family: number; groom_family: number; couple: number } | null,
): Promise<void> {
  if (!(await saveSplitDefault(weddingId, category, shares)))
    throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
}

// A wedding found by its public web address, for the website. Null if there is none.
export async function getWeddingBySlug(slug: string): Promise<WeddingSummary | null> {
  const doc = await findWeddingBySlug(slug);
  return doc ? toSummary(doc) : null;
}

export async function updateWebsite(weddingId: string, changes: WebsiteChanges): Promise<void> {
  const result = await saveWebsiteSettings(weddingId, changes);
  if (result === "slug_taken")
    throw new AppError("VALIDATION_FAILED", "That web address is already taken.", {
      slug: ["That web address is already taken. Try another."],
    });
  if (result === "not_found") throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
}

// ---- the private photo gallery link ----------------------------------------------------------

export type GallerySettings = { token: string; uploadsOn: boolean; showOnWebsite: boolean };

// The gallery link and switches, for the couple's own Share page. Kept out of WeddingSummary so the
// token cannot slip into a page that has no business showing it.
export async function getGallerySettings(weddingId: string): Promise<GallerySettings> {
  const doc = await findWeddingById(weddingId);
  if (!doc || doc.deletedAt) throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
  return {
    token: doc.galleryToken,
    uploadsOn: doc.uploadsOn,
    showOnWebsite: doc.website.showGallery,
  };
}

// What a guest holding a gallery link may know: whose wedding it is and whether uploads are open.
export type GalleryAccess = {
  weddingId: string;
  brideName: string;
  groomName: string;
  uploadsOn: boolean;
  theme: "classical" | "minimal" | "modern";
};

export async function getGalleryByToken(token: string): Promise<GalleryAccess | null> {
  const doc = await findWeddingByGalleryToken(token);
  if (!doc) return null;
  return {
    weddingId: doc._id.toHexString(),
    brideName: doc.brideName,
    groomName: doc.groomName,
    uploadsOn: doc.uploadsOn,
    theme: doc.website.theme,
  };
}

export async function setUploadsOn(weddingId: string, on: boolean): Promise<void> {
  if (!(await saveUploadsOn(weddingId, on)))
    throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
}

// A new gallery link. The old one, and any QR printed from it, stops working immediately.
export async function resetGalleryToken(weddingId: string): Promise<string> {
  const token = generateToken();
  if (!(await saveGalleryToken(weddingId, token)))
    throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
  return token;
}

// Records (or, with null, clears) the cover picture and says which file it replaced, so the caller
// can delete it.
export async function setCoverImage(
  weddingId: string,
  key: string | null,
): Promise<{ previous: string | undefined }> {
  const result = await saveCoverImageKey(weddingId, key);
  if (!result) throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
  return result;
}
