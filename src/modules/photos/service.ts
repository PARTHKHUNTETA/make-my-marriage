import "server-only";
import { ObjectId, type ClientSession } from "mongodb";
import { AppError } from "@/lib/errors";
import { photoQuotaBytes } from "@/lib/env";
import { safeFileName, sniffImageType } from "@/lib/image-types";
import {
  deleteObjects,
  objectSize,
  photoKey,
  readStart,
  signUpload,
  signView,
} from "@/lib/storage";
import {
  confirmSlot,
  countByAlbum,
  deletePhotoDocs,
  ensureAlbums,
  findAbandonedSlots,
  findAlbum,
  findAlbumsByIds,
  findByUploadKeys,
  findPhoto,
  findPhotos,
  listPhotoPage,
  insertSlot,
  moveEventPhotosToGeneral,
  movePhotos as movePhotoDocs,
  usedBytes,
  type PhotoDoc,
} from "./repository";
import {
  MAX_FILE_BYTES,
  PAGE_SIZE,
  type AlbumSummary,
  type ConfirmResult,
  type PhotoItem,
  type UploadFile,
  type UploadSlot,
  type Usage,
} from "./schema";

// Business rules for photos: albums, the upload handshake, quota and moderation state. The only
// caller of the repository, and the way other modules reach this one.

// A slot handed out but never confirmed stops holding quota after this long.
const SLOT_HOLD_MS = 24 * 60 * 60 * 1000;
const slotCutoff = () => new Date(Date.now() - SLOT_HOLD_MS);

const keysOf = (doc: Pick<PhotoDoc, "originalKey" | "displayKey" | "thumbKey">) =>
  [doc.originalKey, doc.displayKey, doc.thumbKey].filter((k): k is string => Boolean(k));

// ---- albums and usage -----------------------------------------------------------------------

export async function getUsage(weddingId: string): Promise<Usage> {
  return { usedBytes: await usedBytes(weddingId, slotCutoff()), quotaBytes: photoQuotaBytes() };
}

// The albums with their counts. Passing the events creates any missing album and keeps names in
// step with the events, so an album exists as soon as its event does.
export async function listAlbums(
  weddingId: string,
  events: { id: string; name: string }[],
): Promise<AlbumSummary[]> {
  const docs = await ensureAlbums(weddingId, events);
  const counts = await countByAlbum(weddingId);
  return docs.map((a) => ({
    id: a._id.toHexString(),
    name: a.name,
    ...(a.eventId ? { eventId: a.eventId.toHexString() } : {}),
    isGeneral: a.isGeneral,
    approvedCount: counts.get(a._id.toHexString())?.approved ?? 0,
    pendingCount: counts.get(a._id.toHexString())?.pending ?? 0,
  }));
}

// Called inside the delete-event transaction.
export async function removeEventAlbum(
  weddingId: string,
  eventId: string,
  { session }: { session: ClientSession },
): Promise<void> {
  await moveEventPhotosToGeneral(weddingId, eventId, session);
}

// ---- the upload handshake -------------------------------------------------------------------

async function removeAbandonedSlots(weddingId: string): Promise<void> {
  const stale = await findAbandonedSlots(weddingId, slotCutoff(), 100);
  if (stale.length === 0) return;
  const docs = await deletePhotoDocs(
    weddingId,
    stale.map((d) => d._id.toHexString()),
  );
  await deleteObjects(docs.flatMap(keysOf)).catch(() => undefined);
}

async function slotFor(doc: PhotoDoc): Promise<UploadSlot> {
  const photoId = doc._id.toHexString();
  if (doc.status !== "uploading") {
    return {
      clientKey: clientKeyOf(doc.uploadKey),
      photoId,
      state: "done",
      contentType: doc.contentType,
    };
  }
  return {
    clientKey: clientKeyOf(doc.uploadKey),
    photoId,
    state: "upload",
    contentType: doc.contentType,
    originalUrl: await signUpload(doc.originalKey, doc.contentType),
    ...(doc.claimedDisplay && doc.displayKey
      ? { displayUrl: await signUpload(doc.displayKey, "image/jpeg") }
      : {}),
    ...(doc.claimedThumb && doc.thumbKey
      ? { thumbUrl: await signUpload(doc.thumbKey, "image/jpeg") }
      : {}),
  };
}

// Hands out an upload address for each file, after checking the album and the storage left. A file
// whose key was seen before gets its earlier slot back, so retries never duplicate. Shared by
// members and, with `uploader` set to a guest, by the guest upload page.
export async function requestUploads(
  weddingId: string,
  input: { albumId: string; files: UploadFile[] },
  uploader: { type: "member"; memberId: string } | { type: "guest"; name?: string },
): Promise<UploadSlot[]> {
  if (!(await findAlbum(weddingId, input.albumId)))
    throw new AppError("NOT_FOUND", "That album no longer exists");
  await removeAbandonedSlots(weddingId);

  const known = new Map(
    (
      await findByUploadKeys(
        weddingId,
        input.files.map((f) => uploadKeyOf(f.clientKey)),
      )
    ).map((d) => [d.uploadKey, d]),
  );
  const fresh = input.files.filter((f) => !known.has(uploadKeyOf(f.clientKey)));
  const needed = fresh.reduce((sum, f) => sum + f.size, 0);
  if (needed > 0) {
    const { usedBytes: used, quotaBytes } = await getUsage(weddingId);
    if (used + needed > quotaBytes) {
      throw new AppError(
        "STORAGE_FULL",
        "This wedding's photo storage is full. Free some space and try again.",
      );
    }
  }

  const now = new Date();
  const slots: UploadSlot[] = [];
  for (const file of input.files) {
    const uploadKey = uploadKeyOf(file.clientKey);
    let doc = known.get(uploadKey);
    if (!doc) {
      const id = new ObjectId();
      const photoId = id.toHexString();
      const candidate: Omit<PhotoDoc, "weddingId"> = {
        _id: id,
        albumId: new ObjectId(input.albumId),
        originalKey: photoKey(weddingId, photoId, "original"),
        displayKey: photoKey(weddingId, photoId, "display"),
        thumbKey: photoKey(weddingId, photoId, "thumb"),
        claimedDisplay: file.hasDisplay,
        claimedThumb: file.hasThumb,
        fileName: safeFileName(file.name, file.type),
        contentType: file.type,
        sizeBytes: file.size,
        uploaderType: uploader.type,
        ...(uploader.type === "member"
          ? { uploaderMemberId: new ObjectId(uploader.memberId) }
          : uploader.name
            ? { uploaderName: uploader.name }
            : {}),
        status: "uploading",
        uploadKey,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const { created } = await insertSlot(weddingId, candidate);
      doc = created
        ? { ...candidate, weddingId: new ObjectId(weddingId) }
        : ((await findByUploadKeys(weddingId, [uploadKey]))[0] ?? undefined);
    }
    if (doc) slots.push(await slotFor(doc));
  }
  return slots;
}

// The stored idempotency key for a device-chosen one.
const uploadKeyOf = (clientKey: string) => `u:${clientKey}`;
const clientKeyOf = (uploadKey: string) => uploadKey.replace(/^u:/, "");

// Checks what really arrived, then makes the photo real: the files must exist, be the size the
// storage reports, and begin like the kind of image they claim to be. Anything else is deleted.
export async function confirmUploads(
  weddingId: string,
  photoIds: string[],
  status: "approved" | "pending",
): Promise<ConfirmResult[]> {
  const docs = await findPhotos(weddingId, photoIds);
  const byId = new Map(docs.map((d) => [d._id.toHexString(), d]));
  const results: ConfirmResult[] = [];
  for (const photoId of photoIds) {
    const doc = byId.get(photoId);
    if (!doc) {
      results.push({ photoId, ok: false, error: "This upload was not found" });
    } else if (doc.status !== "uploading") {
      results.push({ photoId, ok: true }); // confirmed already: confirming again is harmless
    } else {
      results.push(await confirmOne(weddingId, doc, status));
    }
  }
  return results;
}

async function confirmOne(
  weddingId: string,
  doc: PhotoDoc,
  status: "approved" | "pending",
): Promise<ConfirmResult> {
  const photoId = doc._id.toHexString();
  const reject = async (error: string): Promise<ConfirmResult> => {
    const removed = await deletePhotoDocs(weddingId, [photoId]);
    await deleteObjects(removed.flatMap(keysOf)).catch(() => undefined);
    return { photoId, ok: false, error };
  };

  const originalSize = await objectSize(doc.originalKey);
  if (originalSize === null)
    return { photoId, ok: false, error: "The photo did not finish uploading" };
  if (originalSize > MAX_FILE_BYTES) return reject("Each photo can be up to 25 MB");
  const head = await readStart(doc.originalKey, 16);
  if (!head || sniffImageType(head) !== doc.contentType) {
    return reject("That file is not a photo we can accept");
  }

  // A made copy only counts if it arrived and really is a JPEG; otherwise it is dropped and the
  // photo simply has no quick-view copy.
  const copy = async (key: string | undefined, claimed: boolean) => {
    if (!key || !claimed) return null;
    const size = await objectSize(key);
    if (size === null || size > MAX_FILE_BYTES) return null;
    const start = await readStart(key, 16);
    return start && sniffImageType(start) === "image/jpeg" ? { key, size } : null;
  };
  const display = await copy(doc.displayKey, doc.claimedDisplay);
  const thumb = await copy(doc.thumbKey, doc.claimedThumb);
  const leftovers = [doc.displayKey, doc.thumbKey].filter(
    (k): k is string => Boolean(k) && k !== display?.key && k !== thumb?.key,
  );
  if (leftovers.length) await deleteObjects(leftovers).catch(() => undefined);

  const confirmed = await confirmSlot(weddingId, doc._id, {
    status,
    sizeBytes: originalSize + (display?.size ?? 0) + (thumb?.size ?? 0),
    ...(display ? { displayKey: display.key } : {}),
    ...(thumb ? { thumbKey: thumb.key } : {}),
  });
  // Lost a race with another confirmation of the same photo: it is confirmed either way.
  void confirmed;
  return { photoId, ok: true };
}

// ---- viewing and managing -------------------------------------------------------------------

export async function listPhotos(
  weddingId: string,
  filter: { albumId?: string; status: "approved" | "pending" },
  page: number,
): Promise<{ items: PhotoItem[]; total: number; pages: number }> {
  const { docs, total } = await listPhotoPage(weddingId, filter, page, PAGE_SIZE);
  const albumIds = [...new Map(docs.map((d) => [d.albumId.toHexString(), d.albumId])).values()];
  const names = new Map(
    (await findAlbumsByIds(weddingId, albumIds)).map((a) => [a._id.toHexString(), a.name]),
  );
  const items = await Promise.all(
    docs.map(async (d): Promise<PhotoItem> => {
      const viewable = Boolean(d.displayKey) || d.contentType !== "image/heic";
      return {
        id: d._id.toHexString(),
        albumId: d.albumId.toHexString(),
        albumName: names.get(d.albumId.toHexString()) ?? "General",
        fileName: d.fileName,
        contentType: d.contentType,
        sizeBytes: d.sizeBytes,
        uploaderType: d.uploaderType,
        ...(d.uploaderName ? { uploaderName: d.uploaderName } : {}),
        status: d.status === "pending" ? "pending" : "approved",
        uploadedAt: d.uploadedAt.toISOString(),
        viewable,
        ...(d.thumbKey
          ? { thumbUrl: await signView(d.thumbKey) }
          : viewable
            ? { thumbUrl: await signView(d.originalKey) }
            : {}),
        ...(d.displayKey
          ? { displayUrl: await signView(d.displayKey) }
          : viewable
            ? { displayUrl: await signView(d.originalKey) }
            : {}),
      };
    }),
  );
  return { items, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// A save-as address for the original, under a safe file name.
export async function getDownload(
  weddingId: string,
  photoId: string,
): Promise<{ url: string; fileName: string }> {
  const doc = await findPhoto(weddingId, photoId);
  if (!doc || doc.status === "uploading")
    throw new AppError("NOT_FOUND", "That photo no longer exists");
  return {
    url: await signView(doc.originalKey, { download: doc.fileName }),
    fileName: doc.fileName,
  };
}

// Removes photos for good, files included. Photos already gone are skipped, so it is safe to repeat.
export async function deletePhotos(weddingId: string, photoIds: string[]): Promise<number> {
  const docs = await deletePhotoDocs(weddingId, photoIds);
  await deleteObjects(docs.flatMap(keysOf));
  return docs.length;
}

export async function moveToAlbum(
  weddingId: string,
  photoIds: string[],
  albumId: string,
): Promise<number> {
  if (!(await findAlbum(weddingId, albumId)))
    throw new AppError("NOT_FOUND", "That album no longer exists");
  return movePhotoDocs(weddingId, photoIds, albumId);
}

// What the dashboard shows: photos live, photos waiting for a decision, storage used.
export async function getSummary(
  weddingId: string,
): Promise<{ approved: number; pending: number; usage: Usage }> {
  const counts = await countByAlbum(weddingId);
  let approved = 0;
  let pending = 0;
  for (const c of counts.values()) {
    approved += c.approved;
    pending += c.pending;
  }
  return { approved, pending, usage: await getUsage(weddingId) };
}
