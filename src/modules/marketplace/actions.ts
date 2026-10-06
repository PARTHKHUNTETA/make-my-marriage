"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember, requireStaff, requireVendor } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { getEventsByIds } from "@/modules/events/service";
import { getWedding } from "@/modules/wedding/service";
import {
  acceptQuoteSchema,
  bookingRequestSchema,
  listingInputSchema,
  pauseSchema,
  quoteSchema,
  requestIdSchema,
  staffDecisionSchema,
} from "./schema";
import {
  acceptQuote,
  cancelBooking,
  declineRequest,
  decideListing,
  quoteRequest,
  saveMyListing,
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
