import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

// Deleting a wedding touches every collection that holds its data, so this repository is the one
// place that names them all. Everything is keyed by the wedding's id and nothing else.

// Every collection whose documents carry the wedding's id as `weddingId`. The wedding itself
// ("weddings") is removed last, on its own, so a half-finished erase can be run again.
const WEDDING_COLLECTIONS = [
  "weddingMembers",
  "memberInvites",
  "events",
  "tasks",
  "guests",
  "checkIns",
  "seatingTables",
  "expenses",
  "budgets",
  "vendors",
  "albums",
  "photos",
  "notifications",
  "bookingRequests", // requests this wedding sent to marketplace vendors
  "reviews", // reviews this wedding wrote
  "emailQueue", // emails still waiting for this wedding
] as const;

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

// Hides the wedding at once: marks it deleted (only the first time, so the 7-day clock never
// restarts) and removes everyone's access. Returns false if there is no such live wedding.
export async function softDeleteWedding(weddingId: string, now: Date): Promise<boolean> {
  const _id = oid(weddingId);
  if (!_id) return false;
  const db = await getDb();
  const res = await db
    .collection("weddings")
    .updateOne(
      { _id, deletedAt: { $exists: false } },
      { $set: { deletedAt: now, updatedAt: now } },
    );
  if (res.matchedCount === 0) return false;
  await Promise.all([
    db.collection("weddingMembers").deleteMany({ weddingId: _id }),
    db.collection("memberInvites").deleteMany({ weddingId: _id }),
  ]);
  return true;
}

// Weddings deleted at or before the cutoff, oldest first.
export async function findDeletedBefore(cutoff: Date, limit: number): Promise<string[]> {
  const rows = await (
    await getDb()
  )
    .collection("weddings")
    .find({ deletedAt: { $lte: cutoff } })
    .sort({ deletedAt: 1 })
    .limit(limit)
    .project({ _id: 1 })
    .toArray();
  return rows.map((r) => r._id.toHexString());
}

// Every file the wedding stored: photo versions and cover pictures.
export async function listFileKeys(weddingId: string): Promise<string[]> {
  const _id = oid(weddingId);
  if (!_id) return [];
  const db = await getDb();
  const [photos, events, wedding] = await Promise.all([
    db
      .collection("photos")
      .find({ weddingId: _id })
      .project({ originalKey: 1, displayKey: 1, thumbKey: 1 })
      .toArray(),
    db
      .collection("events")
      .find({ weddingId: _id, coverImageKey: { $exists: true } })
      .project({ coverImageKey: 1 })
      .toArray(),
    db.collection("weddings").findOne({ _id }, { projection: { coverImageKey: 1 } }),
  ]);
  const keys = [
    ...photos.flatMap((p) => [p.originalKey, p.displayKey, p.thumbKey]),
    ...events.map((e) => e.coverImageKey),
    wedding?.coverImageKey,
  ];
  return [...new Set(keys.filter((k): k is string => typeof k === "string" && k.length > 0))];
}

// Erases every row of the wedding. Safe to repeat.
export async function eraseWeddingRows(weddingId: string): Promise<Record<string, number>> {
  const _id = oid(weddingId);
  if (!_id) return {};
  const db = await getDb();
  const counts: Record<string, number> = {};
  for (const name of WEDDING_COLLECTIONS) {
    counts[name] = (await db.collection(name).deleteMany({ weddingId: _id })).deletedCount;
  }
  counts.weddings = (await db.collection("weddings").deleteOne({ _id })).deletedCount;
  return counts;
}
