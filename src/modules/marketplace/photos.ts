import "server-only";
import { ObjectId } from "mongodb";
import { AppError } from "@/lib/errors";
import { sniffImageType } from "@/lib/image-types";
import {
  deleteObjects,
  listingPhotoKey,
  objectSize,
  readStart,
  signUpload,
  signView,
} from "@/lib/storage";
import {
  addListingPhoto,
  findListingByAccount,
  MAX_LISTING_PHOTOS,
  moveListingPhotoFirst,
  pullListingPhoto,
} from "./repository";

// A vendor's listing photos (PRD 5.12: up to 20). The browser makes a web-sized JPEG, sends it
// straight to storage, and then asks us to confirm; the server checks the file really is a JPEG.
// Adding a photo sends the listing back for the team's review, like any other edit.

export const MAX_LISTING_PHOTO_BYTES = 8 * 1024 * 1024;
const VIEW_SECONDS = 60 * 60;

export type ListingPhotoSlot = { photoId: string; uploadUrl: string };

async function ownListing(accountId: string) {
  const listing = await findListingByAccount(accountId);
  if (!listing) throw new AppError("NOT_FOUND", "Save your listing first, then add photos.");
  return listing;
}

// Upload addresses for up to `count` more photos, never past the limit of 20 in total.
export async function requestListingPhotoSlots(
  accountId: string,
  count: number,
): Promise<ListingPhotoSlot[]> {
  const listing = await ownListing(accountId);
  const room = MAX_LISTING_PHOTOS - (listing.photoKeys?.length ?? 0);
  if (room <= 0)
    throw new AppError(
      "VALIDATION_FAILED",
      `A listing can have up to ${MAX_LISTING_PHOTOS} photos.`,
    );
  const listingId = listing._id.toHexString();
  return Promise.all(
    Array.from({ length: Math.min(count, room) }, async () => {
      const photoId = new ObjectId().toHexString();
      return {
        photoId,
        uploadUrl: await signUpload(listingPhotoKey(listingId, photoId), "image/jpeg"),
      };
    }),
  );
}

// Checks the uploaded file and adds it to the listing. Confirming the same photo twice is harmless.
export async function confirmListingPhoto(accountId: string, photoId: string): Promise<void> {
  const listing = await ownListing(accountId);
  const key = listingPhotoKey(listing._id.toHexString(), photoId);
  const size = await objectSize(key);
  if (size === null)
    throw new AppError(
      "VALIDATION_FAILED",
      "The photo did not finish uploading. Please try again.",
    );
  const head = size > MAX_LISTING_PHOTO_BYTES ? null : await readStart(key, 16);
  if (!head || sniffImageType(head) !== "image/jpeg") {
    await deleteObjects([key]).catch(() => undefined);
    throw new AppError(
      "VALIDATION_FAILED",
      size > MAX_LISTING_PHOTO_BYTES
        ? "That photo is too large."
        : "That file is not a photo we can use.",
    );
  }
  const outcome = await addListingPhoto(accountId, key);
  if (outcome === "full") {
    await deleteObjects([key]).catch(() => undefined);
    throw new AppError(
      "VALIDATION_FAILED",
      `A listing can have up to ${MAX_LISTING_PHOTOS} photos.`,
    );
  }
  if (outcome === "no_listing")
    throw new AppError("NOT_FOUND", "Save your listing first, then add photos.");
}

export async function removeListingPhoto(accountId: string, photoId: string): Promise<void> {
  const listing = await ownListing(accountId);
  const key = listingPhotoKey(listing._id.toHexString(), photoId);
  if (await pullListingPhoto(accountId, key)) await deleteObjects([key]).catch(() => undefined);
}

export async function makeListingPhotoFirst(accountId: string, photoId: string): Promise<void> {
  const listing = await ownListing(accountId);
  if (
    !(await moveListingPhotoFirst(accountId, listingPhotoKey(listing._id.toHexString(), photoId)))
  )
    throw new AppError("NOT_FOUND", "That photo is no longer on your listing.");
}

// Addresses to show a listing's photos, in order.
export async function listingPhotoUrls(keys: string[]): Promise<{ id: string; url: string }[]> {
  return Promise.all(
    keys.map(async (key) => ({
      id: key.split("/").pop()!,
      url: await signView(key, { seconds: VIEW_SECONDS }),
    })),
  );
}
