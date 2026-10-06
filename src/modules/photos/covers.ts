import "server-only";
import { ObjectId } from "mongodb";
import { AppError } from "@/lib/errors";
import { sniffImageType } from "@/lib/image-types";
import {
  COVER_URL_SECONDS,
  coverKey,
  deleteObjects,
  objectSize,
  readStart,
  signUpload,
  signView,
} from "@/lib/storage";
import { getEvent, setEventCover } from "@/modules/events/service";
import { setCoverImage } from "@/modules/wedding/service";

// Cover pictures: one for the wedding (the website's top picture and the dashboard banner) and one
// per event. The browser makes a single JPEG (at most 1920 px wide), sends it straight to storage,
// and then asks us to confirm; the server checks the file really is a JPEG before using it. This
// sits beside the gallery code, not in it, because it needs the wedding and events modules.

export const MAX_COVER_BYTES = 8 * 1024 * 1024;

export type CoverTarget = { kind: "wedding" } | { kind: "event"; eventId: string };

async function assertTarget(weddingId: string, target: CoverTarget): Promise<void> {
  if (target.kind === "event" && !(await getEvent(weddingId, target.eventId)))
    throw new AppError("NOT_FOUND", "That event no longer exists.");
}

// A fresh upload address for a new picture. Nothing changes until it is confirmed.
export async function requestCoverUpload(
  weddingId: string,
  target: CoverTarget,
): Promise<{ coverId: string; uploadUrl: string }> {
  await assertTarget(weddingId, target);
  const coverId = new ObjectId().toHexString();
  return { coverId, uploadUrl: await signUpload(coverKey(weddingId, coverId), "image/jpeg") };
}

// Checks the uploaded file, makes it the cover, and deletes the picture it replaced. Confirming the
// same upload twice changes nothing the second time.
export async function confirmCover(
  weddingId: string,
  target: CoverTarget,
  coverId: string,
): Promise<void> {
  await assertTarget(weddingId, target);
  const key = coverKey(weddingId, coverId);
  const size = await objectSize(key);
  if (size === null)
    throw new AppError(
      "VALIDATION_FAILED",
      "The picture did not finish uploading. Please try again.",
    );
  const head = size > MAX_COVER_BYTES ? null : await readStart(key, 16);
  if (!head || sniffImageType(head) !== "image/jpeg") {
    await deleteObjects([key]).catch(() => undefined);
    throw new AppError(
      "VALIDATION_FAILED",
      size > MAX_COVER_BYTES
        ? "That picture is too large."
        : "That file is not a picture we can use.",
    );
  }
  const { previous } =
    target.kind === "wedding"
      ? await setCoverImage(weddingId, key)
      : await setEventCover(weddingId, target.eventId, key);
  if (previous && previous !== key) await deleteObjects([previous]).catch(() => undefined);
}

export async function removeCover(weddingId: string, target: CoverTarget): Promise<void> {
  await assertTarget(weddingId, target);
  const { previous } =
    target.kind === "wedding"
      ? await setCoverImage(weddingId, null)
      : await setEventCover(weddingId, target.eventId, null);
  if (previous) await deleteObjects([previous]).catch(() => undefined);
}

// An address that shows a stored cover picture for the next few days.
export async function coverUrl(key: string | undefined): Promise<string | undefined> {
  return key ? signView(key, { seconds: COVER_URL_SECONDS }) : undefined;
}
