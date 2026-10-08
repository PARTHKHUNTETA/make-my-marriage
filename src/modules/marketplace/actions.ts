"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember, requireStaff, requireVendor } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { getEventsByIds } from "@/modules/events/service";
import { getVendorByListing } from "@/modules/vendors/service";
import { getWedding } from "@/modules/wedding/service";
import {
  acceptQuoteSchema,
  listingPhotoSchema,
  photoSlotsSchema,
  bookingRequestSchema,
  listingInputSchema,
  pauseSchema,
  quoteSchema,
  replySchema,
  requestIdSchema,
  reviewEligibility,
  reviewIdSchema,
  reviewSchema,
  staffDecisionSchema,
} from "./schema";
import {
  confirmListingPhoto,
  makeListingPhotoFirst,
  removeListingPhoto,
  requestListingPhotoSlots,
} from "./photos";
import {
  acceptQuote,
  cancelBooking,
  declineRequest,
  decideListing,
  quoteRequest,
  removeReview,
  replyToReview,
  saveMyListing,
  saveReview,
  sendBookingRequest,
  setListingPaused,
} from "./service";

// Server Actions for the marketplace: the vendor portal (vendor session only) and the internal
// admin (staff only). The vendor account always comes from the signed-in vendor's session, never
// from the input, so a vendor can only ever change their own listing.

const refresh = () => revalidatePath("/", "layout");

export async function saveListingAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    const listing = await saveMyListing(ctx.vendorAccountId, listingInputSchema.parse(input));
    refresh();
    return { status: listing.status };
  });
}

export async function pauseListingAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    const { paused } = pauseSchema.parse(input);
    const listing = await setListingPaused(ctx.vendorAccountId, paused);
    refresh();
    return { status: listing.status };
  });
}

// ---- the vendor's listing photos ----

export async function requestListingPhotoSlotsAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    await consumeRateLimit("listing-photo-slots", subjectKey("vendor", ctx.vendorAccountId), {
      limit: 60,
      windowSeconds: 15 * 60,
    });
    const { sizes } = photoSlotsSchema.parse(input);
    return requestListingPhotoSlots(ctx.vendorAccountId, sizes);
  });
}

export async function confirmListingPhotoAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    const { photoId } = listingPhotoSchema.parse(input);
    await confirmListingPhoto(ctx.vendorAccountId, photoId);
    refresh();
    return { added: true };
  });
}

export async function removeListingPhotoAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    const { photoId } = listingPhotoSchema.parse(input);
    await removeListingPhoto(ctx.vendorAccountId, photoId);
    refresh();
    return { removed: true };
  });
}

export async function makeListingPhotoFirstAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    const { photoId } = listingPhotoSchema.parse(input);
    await makeListingPhotoFirst(ctx.vendorAccountId, photoId);
    refresh();
    return { moved: true };
  });
}

export async function decideListingAction(input: unknown) {
  return safeAction(async () => {
    await requireStaff();
    const { listingId, decision, note } = staffDecisionSchema.parse(input);
    const listing = await decideListing(listingId, decision, note);
    refresh();
    return { status: listing.status };
  });
}

// ---- couples: booking requests ----

// A couple asks a vendor for a quote. The events must be this wedding's own; their names and dates
// are copied into the request, which is all the vendor will ever see of the wedding.
export async function sendBookingRequestAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const parsed = bookingRequestSchema.parse(input);
    await consumeRateLimit("booking-request", subjectKey("wedding", ctx.weddingId), {
      limit: 20,
      windowSeconds: 24 * 60 * 60,
    });
    const wanted = [...new Set(parsed.eventIds)];
    const events = await getEventsByIds(ctx.weddingId, wanted);
    if (events.length !== wanted.length)
      throw new AppError("VALIDATION_FAILED", "One of those events no longer exists.", {
        eventIds: ["Choose from the events in the list"],
      });
    const wedding = await getWedding(ctx.weddingId);
    const request = await sendBookingRequest(
      ctx.weddingId,
      { ...parsed, city: parsed.city ?? wedding?.city },
      {
        ids: events.map((e) => e.id),
        snapshots: events.map((e) => ({ name: e.name, date: e.date })),
      },
    );
    refresh();
    return { id: request.id };
  });
}

export async function cancelBookingAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await cancelBooking(ctx.weddingId, requestIdSchema.parse(input).requestId);
    refresh();
    return {};
  });
}

export async function acceptQuoteAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { requestId, amount } = acceptQuoteSchema.parse(input);
    await acceptQuote(ctx.weddingId, requestId, amount);
    refresh();
    return {};
  });
}

// ---- vendors: answering requests ----

export async function quoteRequestAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    const { requestId, amount } = quoteSchema.parse(input);
    await quoteRequest(ctx.vendorAccountId, requestId, amount);
    refresh();
    return {};
  });
}

export async function declineRequestAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    await declineRequest(ctx.vendorAccountId, requestIdSchema.parse(input).requestId);
    refresh();
    return {};
  });
}

// ---- reviews ----

const NOT_ELIGIBLE: Record<"not_booked" | "not_linked" | "not_yet", string> = {
  not_booked: "You can review a vendor once you have booked them through Make My Marriage.",
  not_linked:
    "Link this vendor to your events in My Vendors first, so we know when their work was done.",
  not_yet: "You can write your review after this vendor's last event is over.",
};

// A couple reviews a vendor they booked, after the vendor's last linked event. One review per
// wedding per vendor; writing again changes it.
export async function writeReviewAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const parsed = reviewSchema.parse(input);
    await consumeRateLimit("review", subjectKey("wedding", ctx.weddingId), {
      limit: 20,
      windowSeconds: 24 * 60 * 60,
    });
    const vendor = await getVendorByListing(ctx.weddingId, parsed.listingId);
    const events = vendor ? await getEventsByIds(ctx.weddingId, vendor.eventIds) : [];
    const eligibility = reviewEligibility(
      vendor !== null,
      events.map((e) => e.date),
    );
    if (eligibility.state !== "eligible")
      throw new AppError("FORBIDDEN", NOT_ELIGIBLE[eligibility.state]);
    await saveReview(ctx.weddingId, parsed);
    refresh();
    return {};
  });
}

// A vendor's one public reply to a review about them.
export async function replyToReviewAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    const { reviewId, text } = replySchema.parse(input);
    await replyToReview(ctx.vendorAccountId, reviewId, text);
    refresh();
    return {};
  });
}

// The team removes an abusive review.
export async function removeReviewAction(input: unknown) {
  return safeAction(async () => {
    await requireStaff();
    await removeReview(reviewIdSchema.parse(input).reviewId);
    refresh();
    return {};
  });
}
