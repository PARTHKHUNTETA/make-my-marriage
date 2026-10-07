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
  approveFromUploader,
  approvePhotos,
  confirmSlot,
  countPending,
  countPendingBefore,
  deletePendingDocs,
  findStalePending,
  listPending,
  countApprovedByAlbumAndUploader,
  countByAlbum,
  deletePhotoDocs,
  ensureAlbums,
  findAbandonedSlots,
  findApprovedForDownload,
  listApprovedForDownload,
  type DownloadRow,
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
import { planParts, ZIP_PART_BYTES, ZIP_PART_FILES } from "./zip";
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
  // Independent of each other, so they run together.
  const [docs, counts] = await Promise.all([
    ensureAlbums(weddingId, events),
    countByAlbum(weddingId),
  ]);
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
  uploaderType: "member" | "guest",
): Promise<ConfirmResult[]> {
  // Members' photos go live at once; a guest's wait for a member's decision.
  const status = uploaderType === "member" ? "approved" : "pending";
  // Each side confirms only its own uploads, so a guest cannot touch a member's photo in flight.
  const docs = (await findPhotos(weddingId, photoIds)).filter(
    (d) => d.uploaderType === uploaderType,
  );
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

async function toItem(d: PhotoDoc, names: Map<string, string>): Promise<PhotoItem> {
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
}

export async function listPhotos(
  weddingId: string,
  filter: { albumId?: string; status: "approved" | "pending" },
  page: number,
  // Album names the caller already has, which saves looking them up again.
  knownAlbums?: { id: string; name: string }[],
): Promise<{ items: PhotoItem[]; total: number; pages: number }> {
  const { docs, total } = await listPhotoPage(weddingId, filter, page, PAGE_SIZE);
  const names = new Map((knownAlbums ?? []).map((a) => [a.id, a.name]));
  const missing = [
    ...new Map(
      docs
        .filter((d) => !names.has(d.albumId.toHexString()))
        .map((d) => [d.albumId.toHexString(), d.albumId]),
    ).values(),
  ];
  if (missing.length > 0)
    for (const a of await findAlbumsByIds(weddingId, missing))
      names.set(a._id.toHexString(), a.name);
  const items = await Promise.all(docs.map((d) => toItem(d, names)));
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
  const [counts, usage] = await Promise.all([countByAlbum(weddingId), getUsage(weddingId)]);
  let approved = 0;
  let pending = 0;
  for (const c of counts.values()) {
    approved += c.approved;
    pending += c.pending;
  }
  return { approved, pending, usage };
}

// ---- moderation -----------------------------------------------------------------------------

export const PENDING_KEEP_DAYS = 60;
export const PENDING_WARN_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_LIMIT = 300;

export type PendingGroup = { uploader: string | null; label: string; items: PhotoItem[] };

// Waiting photos grouped by who added them, plus how many will soon be deleted unreviewed.
export async function listPendingGroups(
  weddingId: string,
): Promise<{ groups: PendingGroup[]; total: number; expiring: number; daysLeft: number }> {
  // The counts do not depend on the photos, so they are fetched while the photos are.
  const [docs, total, expiring] = await Promise.all([
    listPending(weddingId, REVIEW_LIMIT),
    countPending(weddingId),
    countPendingBefore(weddingId, new Date(Date.now() - PENDING_WARN_DAYS * DAY_MS)),
  ]);
  const albumIds = [...new Map(docs.map((d) => [d.albumId.toHexString(), d.albumId])).values()];
  const names = new Map(
    (await findAlbumsByIds(weddingId, albumIds)).map((a) => [a._id.toHexString(), a.name]),
  );
  const items = await Promise.all(docs.map((d) => toItem(d, names)));
  const groups = new Map<string, PendingGroup>();
  items.forEach((item, i) => {
    const uploader = docs[i]!.uploaderName ?? null;
    const key = uploader ?? "\u0000anonymous";
    const group = groups.get(key) ?? {
      uploader,
      label: uploader ?? "Guests who gave no name",
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  });
  const oldest = docs[0]?.uploadedAt;
  return {
    groups: [...groups.values()],
    total,
    expiring,
    daysLeft: oldest
      ? Math.max(0, PENDING_KEEP_DAYS - Math.floor((Date.now() - oldest.getTime()) / DAY_MS))
      : PENDING_KEEP_DAYS,
  };
}

export async function approve(weddingId: string, photoIds: string[]): Promise<number> {
  return approvePhotos(weddingId, photoIds);
}

export async function approveAllFrom(weddingId: string, uploader: string | null): Promise<number> {
  return approveFromUploader(weddingId, uploader);
}

// Rejecting deletes for good, files included. Photos already decided are left alone.
export async function reject(weddingId: string, photoIds: string[]): Promise<number> {
  const docs = await deletePendingDocs(weddingId, photoIds);
  await deleteObjects(docs.flatMap(keysOf));
  return docs.length;
}

// The daily sweep: waiting photos that nobody reviewed for PENDING_KEEP_DAYS are deleted, files
// included. Members are warned on the review page from PENDING_WARN_DAYS.
export async function purgeStalePending(now = new Date()): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - PENDING_KEEP_DAYS * DAY_MS);
  let deleted = 0;
  for (let round = 0; round < 20; round++) {
    const stale = await findStalePending(cutoff, 200);
    if (stale.length === 0) break;
    const byWedding = new Map<string, string[]>();
    for (const doc of stale) {
      const key = doc.weddingId.toHexString();
      byWedding.set(key, [...(byWedding.get(key) ?? []), doc._id.toHexString()]);
    }
    for (const [weddingId, ids] of byWedding) deleted += await reject(weddingId, ids);
  }
  return { deleted };
}

// ---- ZIP downloads --------------------------------------------------------------------------

export type ZipPart = { index: number; count: number; bytes: number };
export type ZipEntry = { fileName: string; url: string };

const summarise = (parts: DownloadRow[][]): ZipPart[] =>
  parts.map((rows, index) => ({
    index,
    count: rows.length,
    bytes: rows.reduce((n, r) => n + r.bytes, 0),
  }));

// How an album (or every photo) would be split into ZIP parts.
export async function getZipPlan(weddingId: string, albumId?: string): Promise<ZipPart[]> {
  return summarise(planParts(await listApprovedForDownload(weddingId, albumId)));
}

// The files of one part, each with a short-lived address to fetch it from.
export async function getZipPart(
  weddingId: string,
  albumId: string | undefined,
  index: number,
): Promise<ZipEntry[]> {
  const parts = planParts(await listApprovedForDownload(weddingId, albumId));
  const rows = parts[index];
  if (!rows) throw new AppError("NOT_FOUND", "That part no longer exists");
  return Promise.all(
    rows.map(async (r) => ({
      fileName: r.fileName,
      url: await signView(r.originalKey, { seconds: 15 * 60 }),
    })),
  );
}

// The files of photos picked by hand, in the order given. Too many or too big is refused up
// front, so the browser is never asked for more than it can hold.
export async function getZipSelection(weddingId: string, photoIds: string[]): Promise<ZipEntry[]> {
  const tooMany = () =>
    new AppError(
      "VALIDATION_FAILED",
      `Pick up to ${ZIP_PART_FILES} photos or about ${Math.round(ZIP_PART_BYTES / 1024 / 1024)} MB at a time, or download the whole album in parts.`,
    );
  if (photoIds.length > ZIP_PART_FILES) throw tooMany();
  const rows = await findApprovedForDownload(weddingId, photoIds);
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Those photos no longer exist");
  if (rows.reduce((n, r) => n + r.bytes, 0) > ZIP_PART_BYTES) throw tooMany();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = photoIds.map((id) => byId.get(id)).filter((r): r is DownloadRow => Boolean(r));
  return Promise.all(
    ordered.map(async (r) => ({
      fileName: r.fileName,
      url: await signView(r.originalKey, { seconds: 15 * 60 }),
    })),
  );
}

export type PhotoBreakdown = {
  albumId: string;
  name: string;
  eventId?: string;
  member: number;
  guest: number;
};

// Approved photos per album, members' against guests', for the Analytics page.
export async function getPhotoBreakdown(
  weddingId: string,
  events: { id: string; name: string }[],
): Promise<PhotoBreakdown[]> {
  const albums = await listAlbums(weddingId, events);
  const counts = await countApprovedByAlbumAndUploader(weddingId);
  return albums.map((a) => ({
    albumId: a.id,
    name: a.name,
    ...(a.eventId ? { eventId: a.eventId } : {}),
    member: counts.get(a.id)?.member ?? 0,
    guest: counts.get(a.id)?.guest ?? 0,
  }));
}
