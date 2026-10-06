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
  saveWhatsappMessage,
  updateWeddingDetails as saveWeddingDetails,
  type WeddingDoc,
} from "./repository";
import type { CreateWeddingInput, UpdateWeddingInput, WeddingSummary } from "./schema";

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
    slug: doc.website.slug,
    whatsappMessage: doc.whatsappMessage,
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
