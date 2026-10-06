import "server-only";
import { inTransaction } from "@/lib/db";
import { absoluteUrl } from "@/lib/app-url";
import { queueEmail } from "@/lib/email";
import { ObjectId } from "mongodb";
import { AppError } from "@/lib/errors";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/passwords";
import { generateToken, hashToken } from "@/lib/tokens";
import {
  consumeResetToken,
  consumeVerifyToken,
  findAccountByEmail,
  findAccountById,
  findAccountsByIds,
  findApprovedListing,
  findListingByAccount,
  findListingById,
  findOpenRequestForListing,
  findRequestForWedding,
  insertAccount,
  insertRequest,
  listListingsForStaff,
  listRequestsForVendor,
  listRequestsForWedding,
  searchApprovedListings,
  transitionRequest,
  type BookingRequestDoc,
  setResetToken,
  setVerifyToken,
  transitionListing,
  upsertListing,
  type ListingDoc,
  type VendorAccountDoc,
} from "./repository";
import { createVendorFromBooking, isListingInMyVendors } from "@/modules/vendors/service";
import {
  LISTING_PAGE_SIZE,
  type BookingRequestInput,
  type BookingView,
  type EventSnapshot,
  type ListingQuery,
  type VendorBookingView,
} from "./schema";
import type {
  ListingInput,
  ListingStatus,
  ListingView,
  VendorLoginInput,
  VendorProfile,
  VendorSignupInput,
} from "./schema";

// Business rules for the marketplace module's vendor side (PRD 5.8, api-design §13).

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
// The same message for "no such account" and "wrong password", so login cannot be used to find
// out which businesses have an account.
const BAD_CREDENTIALS = "Incorrect email or password.";
const LINK_INVALID = "This link has expired or has already been used.";

function toProfile(a: VendorAccountDoc): VendorProfile {
  return {
    id: a._id.toHexString(),
    businessName: a.businessName,
    email: a.email,
    phone: a.phone,
    emailVerified: a.emailVerified,
  };
}

async function sendVerification(a: Pick<VendorAccountDoc, "_id" | "businessName" | "email">) {
  const token = generateToken();
  await setVerifyToken(a._id.toHexString(), hashToken(token), new Date(Date.now() + VERIFY_TTL_MS));
  await queueEmail({
    type: "verify",
    toEmail: a.email,
    payload: { name: a.businessName, url: absoluteUrl(`/vendor/verify-email/${token}`) },
  });
}

export async function signUpVendor(input: VendorSignupInput): Promise<VendorProfile> {
  const account = await insertAccount({
    businessName: input.businessName,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
  });
  if (!account)
    throw new AppError("EMAIL_IN_USE", "A vendor account with this email already exists.");
  await sendVerification(account).catch((err) => {
    console.error(
      "could not queue vendor verification email",
      err instanceof Error ? err.name : "unknown",
    );
  });
  return toProfile(account);
}

export async function logInVendor(input: VendorLoginInput): Promise<VendorProfile> {
  const account = await findAccountByEmail(input.email);
  if (!account) {
    await burnPasswordCheck(input.password);
    throw new AppError("UNAUTHENTICATED", BAD_CREDENTIALS);
  }
  if (!(await verifyPassword(account.passwordHash, input.password)))
    throw new AppError("UNAUTHENTICATED", BAD_CREDENTIALS);
  return toProfile(account);
}

export async function getVendorProfile(accountId: string): Promise<VendorProfile | null> {
  const account = await findAccountById(accountId);
  return account ? toProfile(account) : null;
}

// For resolving a vendor session: does the account still exist, and was it reset after the
// session began?
export async function getVendorAuthState(
  accountId: string,
): Promise<{ sessionsValidAfter?: Date } | null> {
  const account = await findAccountById(accountId);
  return account ? { sessionsValidAfter: account.sessionsValidAfter } : null;
}

export async function resendVendorVerification(accountId: string): Promise<void> {
  const account = await findAccountById(accountId);
  if (!account || account.emailVerified) return;
  await sendVerification(account);
}

export async function confirmVendorEmail(token: string): Promise<void> {
  if (!(await consumeVerifyToken(hashToken(token), new Date())))
    throw new AppError("LINK_INVALID", LINK_INVALID);
}

// Always completes without saying whether the address has an account.
export async function requestVendorPasswordReset(email: string): Promise<void> {
  const account = await findAccountByEmail(email);
  if (!account) return;
  const token = generateToken();
  await setResetToken(
    account._id.toHexString(),
    hashToken(token),
    new Date(Date.now() + RESET_TTL_MS),
  );
  await queueEmail({
    type: "reset",
    toEmail: account.email,
    payload: { name: account.businessName, url: absoluteUrl(`/vendor/reset-password/${token}`) },
  });
}

export async function resetVendorPassword(token: string, newPassword: string): Promise<void> {
  const account = await consumeResetToken(
    hashToken(token),
    new Date(),
    await hashPassword(newPassword),
  );
  if (!account) throw new AppError("LINK_INVALID", LINK_INVALID);
}

// ---- the vendor's listing ----

export function toListingView(doc: ListingDoc): ListingView {
  return {
    id: doc._id.toHexString(),
    businessName: doc.businessName,
    category: doc.category,
    cities: doc.cities,
    description: doc.description,
    startingPrice: doc.startingPrice,
    website: doc.links?.website,
    instagram: doc.links?.instagram,
    status: doc.status,
    reviewNote: doc.reviewNote,
    ratingAvg: doc.ratingAvg,
    ratingCount: doc.ratingCount,
    updatedAt: doc.updatedAt,
  };
}

export async function getMyListing(accountId: string): Promise<ListingView | null> {
  const doc = await findListingByAccount(accountId);
  return doc ? toListingView(doc) : null;
}

// Saves the listing and sends it for approval (suspended listings stay suspended).
export async function saveMyListing(accountId: string, input: ListingInput): Promise<ListingView> {
  const account = await findAccountById(accountId);
  if (!account) throw new AppError("UNAUTHENTICATED", "Sign in to continue");
  const links =
    input.website || input.instagram
      ? {
          ...(input.website ? { website: input.website } : {}),
          ...(input.instagram ? { instagram: input.instagram } : {}),
        }
      : undefined;
  const doc = await upsertListing(accountId, {
    businessName: account.businessName,
    category: input.category,
    cities: input.cities,
    description: input.description,
    startingPrice: input.startingPrice,
    links,
  });
  if (!doc) throw new AppError("INTERNAL", "We couldn't save your listing. Please try again.");
  return toListingView(doc);
}

// Pausing hides a live listing; resuming brings it back without another review, since it was
// already approved.
export async function setListingPaused(accountId: string, paused: boolean): Promise<ListingView> {
  const doc = paused
    ? await transitionListing({ accountId }, ["approved"], "paused", null)
    : await transitionListing({ accountId }, ["paused"], "approved", null);
  if (!doc)
    throw new AppError(
      "FORBIDDEN",
      paused ? "Only a live listing can be paused." : "This listing isn't paused.",
    );
  return toListingView(doc);
}

// ---- internal admin (the Make My Marriage team) ----

export type StaffListing = ListingView & { vendorEmail: string };

export async function listForStaff(): Promise<StaffListing[]> {
  const docs = await listListingsForStaff();
  const accounts = new Map(
    (await findAccountsByIds(docs.map((d) => d.vendorAccountId))).map((a) => [
      a._id.toHexString(),
      a,
    ]),
  );
  return docs.map((d) => ({
    ...toListingView(d),
    vendorEmail: accounts.get(d.vendorAccountId.toHexString())?.email ?? "",
  }));
}

const FROM: Record<"approve" | "reject" | "suspend", ListingStatus[]> = {
  approve: ["pending", "rejected", "suspended"],
  reject: ["pending"],
  suspend: ["approved", "paused", "pending"],
};
const TO = { approve: "approved", reject: "rejected", suspend: "suspended" } as const;

export async function decideListing(
  listingId: string,
  decision: "approve" | "reject" | "suspend",
  note?: string,
): Promise<ListingView> {
  const doc = await transitionListing(
    { id: listingId },
    FROM[decision],
    TO[decision],
    decision === "approve" ? null : (note ?? null),
  );
  if (!doc)
    throw new AppError(
      "NOT_FOUND",
      "That listing was not found, or someone already changed it. Refresh and try again.",
    );
  return toListingView(doc);
}

// ---- the marketplace, for couples ----

export async function browseListings(
  query: ListingQuery,
): Promise<{ items: ListingView[]; total: number; page: number; pageSize: number }> {
  const { docs, total } = await searchApprovedListings(query, LISTING_PAGE_SIZE);
  return { items: docs.map(toListingView), total, page: query.page, pageSize: LISTING_PAGE_SIZE };
}

// Only a live listing can be seen by couples; anything else looks the same as one that does not
// exist.
export async function getLiveListing(listingId: string): Promise<ListingView | null> {
  const doc = await findApprovedListing(listingId);
  return doc ? toListingView(doc) : null;
}

function toBookingView(doc: BookingRequestDoc): BookingView {
  return {
    id: doc._id.toHexString(),
    listingId: doc.listingId.toHexString(),
    businessName: doc.businessName,
    events: doc.events,
    city: doc.city,
    expectedHeadcount: doc.expectedHeadcount,
    message: doc.message,
    quotedAmount: doc.quotedAmount,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

// A couple sends a request: the events they chose (as snapshots), the city, an expected headcount,
// a message and optionally how to reach them. That is everything the vendor will ever see.
export async function sendBookingRequest(
  weddingId: string,
  input: BookingRequestInput,
  events: { ids: string[]; snapshots: EventSnapshot[] },
): Promise<BookingView> {
  const listing = await findApprovedListing(input.listingId);
  if (!listing) throw new AppError("NOT_FOUND", "That vendor is not available right now.");
  if (await isListingInMyVendors(weddingId, input.listingId))
    throw new AppError("VALIDATION_FAILED", "This vendor is already in your My Vendors.");
  const doc = await insertRequest({
    weddingId: new ObjectId(weddingId),
    listingId: listing._id,
    vendorAccountId: listing.vendorAccountId,
    businessName: listing.businessName,
    events: events.snapshots,
    eventIds: events.ids.map((id) => new ObjectId(id)),
    ...(input.city ? { city: input.city } : {}),
    ...(input.expectedHeadcount ? { expectedHeadcount: input.expectedHeadcount } : {}),
    ...(input.message ? { message: input.message } : {}),
    ...(input.contactName ? { contactName: input.contactName } : {}),
    ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
  });
  if (!doc)
    throw new AppError("VALIDATION_FAILED", "You already have an open request with this vendor.");
  return toBookingView(doc);
}

export async function listBookings(weddingId: string): Promise<BookingView[]> {
  return (await listRequestsForWedding(weddingId)).map(toBookingView);
}

// The open request (sent or quoted) a wedding has with a listing, if any.
export async function getOpenBooking(
  weddingId: string,
  listingId: string,
): Promise<BookingView | null> {
  const doc = await findOpenRequestForListing(weddingId, listingId);
  return doc ? toBookingView(doc) : null;
}

export async function cancelBooking(weddingId: string, requestId: string): Promise<void> {
  const doc = await transitionRequest(requestId, { weddingId }, ["sent", "quoted"], "cancelled");
  if (!doc)
    throw new AppError("NOT_FOUND", "That request can't be cancelled. It may already be answered.");
}

// The couple accepts the vendor's quote. In one transaction the request becomes accepted and the
// vendor is added to My Vendors with the agreed amount as its total cost. The amount the couple
// saw must still be the current quote, so a quote changed a moment ago is not accepted by mistake.
export async function acceptQuote(
  weddingId: string,
  requestId: string,
  seenAmount: number,
): Promise<void> {
  const request = await findRequestForWedding(weddingId, requestId);
  if (!request) throw new AppError("NOT_FOUND", "That request no longer exists.");
  const [listing, account] = await Promise.all([
    findListingById(request.listingId.toHexString()),
    findAccountById(request.vendorAccountId.toHexString()),
  ]);
  if (!listing || !account) throw new AppError("NOT_FOUND", "That vendor is no longer available.");

  await inTransaction(async (session) => {
    const accepted = await transitionRequest(
      requestId,
      { weddingId },
      ["quoted"],
      "accepted",
      { onlyIfQuoted: seenAmount },
      { session },
    );
    if (!accepted)
      throw new AppError(
        "VALIDATION_FAILED",
        "This quote has changed or is no longer open. Refresh to see the latest.",
      );
    await createVendorFromBooking(
      weddingId,
      {
        listingId: listing._id.toHexString(),
        name: listing.businessName,
        category: listing.category,
        phone: account.phone,
        email: account.email,
        totalCost: seenAmount,
        eventIds: request.eventIds.map((e) => e.toHexString()),
      },
      { session },
    );
  });
}

// ---- booking requests, for vendors ----

function toVendorBookingView(doc: BookingRequestDoc): VendorBookingView {
  return {
    id: doc._id.toHexString(),
    events: doc.events,
    city: doc.city,
    expectedHeadcount: doc.expectedHeadcount,
    message: doc.message,
    contactName: doc.contactName,
    contactPhone: doc.contactPhone,
    quotedAmount: doc.quotedAmount,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

export async function listVendorBookings(accountId: string): Promise<VendorBookingView[]> {
  return (await listRequestsForVendor(accountId)).map(toVendorBookingView);
}

export async function quoteRequest(
  accountId: string,
  requestId: string,
  amount: number,
): Promise<void> {
  const doc = await transitionRequest(
    requestId,
    { vendorAccountId: accountId },
    ["sent", "quoted"],
    "quoted",
    {
      quotedAmount: amount,
    },
  );
  if (!doc)
    throw new AppError(
      "NOT_FOUND",
      "That request can't be quoted. It may have been cancelled or answered.",
    );
}

export async function declineRequest(accountId: string, requestId: string): Promise<void> {
  const doc = await transitionRequest(
    requestId,
    { vendorAccountId: accountId },
    ["sent", "quoted"],
    "declined",
  );
  if (!doc)
    throw new AppError(
      "NOT_FOUND",
      "That request can't be declined. It may have been cancelled or answered.",
    );
}
