import "server-only";
import { absoluteUrl } from "@/lib/app-url";
import { queueEmail } from "@/lib/email";
import { AppError } from "@/lib/errors";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/passwords";
import { generateToken, hashToken } from "@/lib/tokens";
import {
  consumeResetToken,
  consumeVerifyToken,
  findAccountByEmail,
  findAccountById,
  findAccountsByIds,
  findListingByAccount,
  insertAccount,
  listListingsForStaff,
  setResetToken,
  setVerifyToken,
  transitionListing,
  upsertListing,
  type ListingDoc,
  type VendorAccountDoc,
} from "./repository";
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
