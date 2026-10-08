import "server-only";
import { MongoServerError, ObjectId, type ClientSession, type Collection } from "mongodb";
import { getDb } from "@/lib/db";
import type { ImageType } from "@/lib/image-types";
import { scoped } from "@/lib/scoped";

// All MongoDB access for the photos module, always through scoped(). Photo bytes live in R2;
// these documents hold only the metadata and the keys (db-design §9).
export type AlbumDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  eventId?: ObjectId; // unset for the General album
  name: string;
  isGeneral: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// "uploading" is a slot handed out but not yet confirmed: invisible everywhere, but it holds its
// size against the quota so a batch cannot overshoot it.
export type PhotoStatus = "uploading" | "pending" | "approved";

export type PhotoDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  albumId: ObjectId;
  originalKey: string;
  displayKey?: string;
  thumbKey?: string;
  claimedDisplay: boolean;
  claimedThumb: boolean;
  // The sizes the upload addresses were signed for (set with the claims above).
  displayBytes?: number;
  thumbBytes?: number;
  fileName: string;
  contentType: ImageType;
  sizeBytes: number;
  uploaderType: "member" | "guest";
  uploaderMemberId?: ObjectId;
  uploaderName?: string;
  status: PhotoStatus;
  uploadKey: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

let albumsReady: Promise<Collection<AlbumDoc>> | undefined;
let photosReady: Promise<Collection<PhotoDoc>> | undefined;

function albums(): Promise<Collection<AlbumDoc>> {
  albumsReady ??= (async () => {
    const col = (await getDb()).collection<AlbumDoc>("albums");
    await col.createIndex(
      { weddingId: 1, isGeneral: 1 },
      { unique: true, partialFilterExpression: { isGeneral: true } },
    );
    await col.createIndex(
      { weddingId: 1, eventId: 1 },
      { unique: true, partialFilterExpression: { eventId: { $exists: true } } },
    );
    return col;
  })();
  albumsReady.catch(() => {
    albumsReady = undefined;
  });
  return albumsReady;
}

function photos(): Promise<Collection<PhotoDoc>> {
  photosReady ??= (async () => {
    const col = (await getDb()).collection<PhotoDoc>("photos");
    await col.createIndex({ weddingId: 1, albumId: 1, status: 1, uploadedAt: -1 });
    // The same file sent twice finds the first one.
    await col.createIndex(
      { weddingId: 1, uploadKey: 1 },
      { unique: true, partialFilterExpression: { uploadKey: { $exists: true } } },
    );
    return col;
  })();
  photosReady.catch(() => {
    photosReady = undefined;
  });
  return photosReady;
}

const oid = (id: string) => new ObjectId(id);
const isDuplicate = (err: unknown) => err instanceof MongoServerError && err.code === 11000;

// ---- albums ---------------------------------------------------------------------------------

// Makes sure the General album and one album per event exist, with the events' current names.
// Looking is cheap and writing is not, so it reads first and only writes what is actually missing
// or renamed: an ordinary page view is a single read.
export async function ensureAlbums(
  weddingId: string,
  events: { id: string; name: string }[],
): Promise<AlbumDoc[]> {
  const col = scoped(await albums(), { weddingId });
  const order = (docs: AlbumDoc[]) =>
    [...docs].sort(
      (a, b) =>
        Number(b.isGeneral) - Number(a.isGeneral) || a.createdAt.getTime() - b.createdAt.getTime(),
    );
  const existing = await col.find({}).toArray();
  const byEvent = new Map(
    existing.flatMap((a) => (a.eventId ? [[a.eventId.toHexString(), a] as const] : [])),
  );
  const work: {
    filter: Record<string, unknown>;
    set: Record<string, unknown>;
    init: Record<string, unknown>;
  }[] = [];
  if (!existing.some((a) => a.isGeneral))
    work.push({ filter: { isGeneral: true }, set: {}, init: { name: "General", isGeneral: true } });
  for (const event of events) {
    const album = byEvent.get(event.id);
    if (!album || album.name !== event.name)
      work.push({
        filter: { eventId: oid(event.id) },
        set: { name: event.name },
        init: { isGeneral: false },
      });
  }
  if (work.length === 0) return order(existing);

  const now = new Date();
  const upsert = async ({ filter, set, init }: (typeof work)[number]) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await col.updateOne(
          filter,
          { $set: { ...set, updatedAt: now }, $setOnInsert: { ...init, createdAt: now } },
          { upsert: true },
        );
        return;
      } catch (err) {
        // Two pages opening at once both try to create it: the second finds the first.
        if (!isDuplicate(err) || attempt === 1) throw err;
      }
    }
  };
  await Promise.all(work.map(upsert));
  return order(await col.find({}).toArray());
}

export async function findAlbum(weddingId: string, albumId: string): Promise<AlbumDoc | null> {
  return scoped(await albums(), { weddingId }).findOne({ _id: oid(albumId) });
}

export async function findGeneralAlbum(weddingId: string): Promise<AlbumDoc | null> {
  return scoped(await albums(), { weddingId }).findOne({ isGeneral: true });
}

export async function findAlbumsByIds(weddingId: string, ids: ObjectId[]): Promise<AlbumDoc[]> {
  return scoped(await albums(), { weddingId })
    .find({ _id: { $in: ids } })
    .toArray();
}

// ---- photos ---------------------------------------------------------------------------------

export async function insertSlot(
  weddingId: string,
  doc: Omit<PhotoDoc, "weddingId">,
): Promise<{ created: boolean }> {
  try {
    await scoped(await photos(), { weddingId }).insertOne(doc);
    return { created: true };
  } catch (err) {
    if (isDuplicate(err)) return { created: false };
    throw err;
  }
}

export async function findByUploadKeys(weddingId: string, keys: string[]): Promise<PhotoDoc[]> {
  return scoped(await photos(), { weddingId })
    .find({ uploadKey: { $in: keys } })
    .toArray();
}

export async function findPhotos(weddingId: string, ids: string[]): Promise<PhotoDoc[]> {
  return scoped(await photos(), { weddingId })
    .find({ _id: { $in: ids.map(oid) } })
    .toArray();
}

export async function findPhoto(weddingId: string, id: string): Promise<PhotoDoc | null> {
  return scoped(await photos(), { weddingId }).findOne({ _id: oid(id) });
}

// Turns a slot into a photo, once: confirming twice changes nothing the second time.
export async function confirmSlot(
  weddingId: string,
  id: ObjectId,
  fields: {
    status: "pending" | "approved";
    sizeBytes: number;
    displayKey?: string;
    thumbKey?: string;
  },
): Promise<boolean> {
  const now = new Date();
  const { displayKey, thumbKey, ...rest } = fields;
  const result = await scoped(await photos(), { weddingId }).updateOne(
    { _id: id, status: "uploading" },
    {
      $set: {
        ...rest,
        ...(displayKey ? { displayKey } : {}),
        ...(thumbKey ? { thumbKey } : {}),
        uploadedAt: now,
        updatedAt: now,
      },
      $unset: {
        ...(displayKey ? {} : { displayKey: "" }),
        ...(thumbKey ? {} : { thumbKey: "" }),
      },
    },
  );
  return result.modifiedCount === 1;
}

// Removes the documents and hands them back so the caller can delete the files too.
export async function deletePhotoDocs(weddingId: string, ids: string[]): Promise<PhotoDoc[]> {
  const col = scoped(await photos(), { weddingId });
  const filter = { _id: { $in: ids.map(oid) } };
  const docs = await col.find(filter).toArray();
  if (docs.length > 0) await col.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
  return docs;
}

export async function movePhotos(
  weddingId: string,
  ids: string[],
  albumId: string,
): Promise<number> {
  const result = await scoped(await photos(), { weddingId }).updateMany(
    { _id: { $in: ids.map(oid) }, status: { $ne: "uploading" } },
    { $set: { albumId: oid(albumId), updatedAt: new Date() } },
  );
  return result.modifiedCount;
}

// An event's album goes; its photos join the General album (db-design §13). Runs inside the
// event-delete transaction.
export async function moveEventPhotosToGeneral(
  weddingId: string,
  eventId: string,
  session: ClientSession,
): Promise<void> {
  const albumCol = scoped(await albums(), { weddingId });
  const album = await albumCol.findOne({ eventId: oid(eventId) }, { session });
  if (!album) return;
  const general = await albumCol.findOne({ isGeneral: true }, { session });
  if (general) {
    await scoped(await photos(), { weddingId }).updateMany(
      { albumId: album._id },
      { $set: { albumId: general._id, updatedAt: new Date() } },
      { session },
    );
  }
  await albumCol.deleteOne({ _id: album._id }, { session });
}

export async function listPhotoPage(
  weddingId: string,
  filter: { albumId?: string; status: "pending" | "approved" },
  page: number,
  pageSize: number,
): Promise<{ docs: PhotoDoc[]; total: number }> {
  const col = scoped(await photos(), { weddingId });
  const where = {
    status: filter.status,
    ...(filter.albumId ? { albumId: oid(filter.albumId) } : {}),
  };
  const [docs, total] = await Promise.all([
    col
      .find(where, {
        sort: { uploadedAt: -1, _id: -1 },
        skip: (page - 1) * pageSize,
        limit: pageSize,
      })
      .toArray(),
    col.countDocuments(where),
  ]);
  return { docs, total };
}

export async function countByAlbum(
  weddingId: string,
): Promise<Map<string, { approved: number; pending: number }>> {
  const rows = await scoped(await photos(), { weddingId })
    .aggregate<{ _id: { albumId: ObjectId; status: string }; n: number }>([
      { $match: { status: { $in: ["approved", "pending"] } } },
      { $group: { _id: { albumId: "$albumId", status: "$status" }, n: { $sum: 1 } } },
    ])
    .toArray();
  const out = new Map<string, { approved: number; pending: number }>();
  for (const row of rows) {
    const key = row._id.albumId.toHexString();
    const entry = out.get(key) ?? { approved: 0, pending: 0 };
    if (row._id.status === "approved") entry.approved = row.n;
    else entry.pending = row.n;
    out.set(key, entry);
  }
  return out;
}

// Bytes held against the quota: every confirmed photo (waiting ones included) and any slot handed
// out since `slotCutoff`. Older unconfirmed slots are abandoned uploads and no longer count.
export async function usedBytes(weddingId: string, slotCutoff: Date): Promise<number> {
  const [row] = await scoped(await photos(), { weddingId })
    .aggregate<{ total: number }>([
      {
        $match: {
          $or: [{ status: { $ne: "uploading" } }, { createdAt: { $gte: slotCutoff } }],
        },
      },
      { $group: { _id: null, total: { $sum: "$sizeBytes" } } },
    ])
    .toArray();
  return row?.total ?? 0;
}

export async function findAbandonedSlots(
  weddingId: string,
  cutoff: Date,
  limit: number,
): Promise<PhotoDoc[]> {
  return scoped(await photos(), { weddingId })
    .find({ status: "uploading", createdAt: { $lt: cutoff } }, { limit })
    .toArray();
}

// ---- moderation -----------------------------------------------------------------------------

// Photos waiting for a decision, grouped by whoever added them (unnamed guests together).
export async function listPending(weddingId: string, limit: number): Promise<PhotoDoc[]> {
  return scoped(await photos(), { weddingId })
    .find({ status: "pending" }, { sort: { uploaderName: 1, uploadedAt: 1, _id: 1 }, limit })
    .toArray();
}

export async function countPending(weddingId: string): Promise<number> {
  return scoped(await photos(), { weddingId }).countDocuments({ status: "pending" });
}

export async function countPendingBefore(weddingId: string, cutoff: Date): Promise<number> {
  return scoped(await photos(), { weddingId }).countDocuments({
    status: "pending",
    uploadedAt: { $lt: cutoff },
  });
}

// Only waiting photos change: approving something already approved, or still uploading, does nothing.
export async function approvePhotos(weddingId: string, ids: string[]): Promise<number> {
  const result = await scoped(await photos(), { weddingId }).updateMany(
    { _id: { $in: ids.map(oid) }, status: "pending" },
    { $set: { status: "approved", updatedAt: new Date() } },
  );
  return result.modifiedCount;
}

// Every waiting photo from one named person, or from the guests who gave no name (`null`).
export async function approveFromUploader(weddingId: string, name: string | null): Promise<number> {
  const result = await scoped(await photos(), { weddingId }).updateMany(
    {
      status: "pending",
      ...(name === null ? { uploaderName: { $exists: false } } : { uploaderName: name }),
    },
    { $set: { status: "approved", updatedAt: new Date() } },
  );
  return result.modifiedCount;
}

// Removes waiting photos only, handing them back so the caller can delete their files. A photo
// that was approved a moment earlier is left alone.
export async function deletePendingDocs(weddingId: string, ids: string[]): Promise<PhotoDoc[]> {
  const col = scoped(await photos(), { weddingId });
  const docs = await col.find({ _id: { $in: ids.map(oid) }, status: "pending" }).toArray();
  if (docs.length > 0) {
    await col.deleteMany({ _id: { $in: docs.map((d) => d._id) }, status: "pending" });
  }
  return docs;
}

// A system job, not a request: waiting photos nobody decided on, across every wedding, oldest
// first. Callers delete them per wedding through deletePendingDocs().
export async function findStalePending(cutoff: Date, limit: number): Promise<PhotoDoc[]> {
  return (await photos())
    .find({ status: "pending", uploadedAt: { $lt: cutoff } }, { sort: { uploadedAt: 1 }, limit })
    .toArray();
}

// ---- downloads ------------------------------------------------------------------------------

export type DownloadRow = { id: string; fileName: string; originalKey: string; bytes: number };

// Every approved photo (of one album, or all), oldest first, with only what a download needs.
export async function listApprovedForDownload(
  weddingId: string,
  albumId?: string,
): Promise<DownloadRow[]> {
  const docs = await scoped(await photos(), { weddingId })
    .find(
      { status: "approved", ...(albumId ? { albumId: oid(albumId) } : {}) },
      {
        sort: { uploadedAt: 1, _id: 1 },
        projection: { fileName: 1, originalKey: 1, sizeBytes: 1 },
      },
    )
    .toArray();
  return docs.map((d) => ({
    id: d._id.toHexString(),
    fileName: d.fileName,
    originalKey: d.originalKey,
    bytes: d.sizeBytes,
  }));
}

export async function findApprovedForDownload(
  weddingId: string,
  ids: string[],
): Promise<DownloadRow[]> {
  const docs = await scoped(await photos(), { weddingId })
    .find(
      { _id: { $in: ids.map(oid) }, status: "approved" },
      { projection: { fileName: 1, originalKey: 1, sizeBytes: 1 } },
    )
    .toArray();
  return docs.map((d) => ({
    id: d._id.toHexString(),
    fileName: d.fileName,
    originalKey: d.originalKey,
    bytes: d.sizeBytes,
  }));
}

// Approved photos per album, split by who added them.
export async function countApprovedByAlbumAndUploader(
  weddingId: string,
): Promise<Map<string, { member: number; guest: number }>> {
  const rows = await scoped(await photos(), { weddingId })
    .aggregate<{ _id: { albumId: ObjectId; type: string }; n: number }>([
      { $match: { status: "approved" } },
      { $group: { _id: { albumId: "$albumId", type: "$uploaderType" }, n: { $sum: 1 } } },
    ])
    .toArray();
  const out = new Map<string, { member: number; guest: number }>();
  for (const r of rows) {
    const key = r._id.albumId.toHexString();
    const entry = out.get(key) ?? { member: 0, guest: 0 };
    if (r._id.type === "member") entry.member = r.n;
    else entry.guest = r.n;
    out.set(key, entry);
  }
  return out;
}
