import "server-only";
import { MongoBulkWriteError, ObjectId, type Collection } from "mongodb";
import { getDb } from "@/lib/db";
import { KEEP_DAYS } from "./schema";

// All MongoDB access for notifications. Every read and write names its one recipient (a member or a
// vendor account), taken from the signed-in session, so nobody can read or change another
// person's alerts. They are not wedding-scoped queries: a member id belongs to one wedding.
export type NotificationDoc = {
  _id: ObjectId;
  weddingId?: ObjectId; // unset for a vendor's own notifications
  recipientType: "member" | "vendor";
  recipientId: ObjectId;
  type: string;
  message: string;
  link?: string;
  dedupeKey?: string;
  readAt?: Date;
  createdAt: Date;
};

let ready: Promise<Collection<NotificationDoc>> | undefined;

function notifications(): Promise<Collection<NotificationDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<NotificationDoc>("notifications");
    await col.createIndex({ recipientType: 1, recipientId: 1, createdAt: -1 });
    // Old notifications delete themselves.
    await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: KEEP_DAYS * 24 * 60 * 60 });
    // A daily job that runs twice, or an alert for the same thing, tells each person once.
    await col.createIndex(
      { recipientId: 1, dedupeKey: 1 },
      { unique: true, partialFilterExpression: { dedupeKey: { $exists: true } } },
    );
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

export type NewNotification = Omit<NotificationDoc, "_id" | "createdAt">;

// Saves them all; ones that repeat an earlier dedupeKey are quietly skipped. Returns how many were new.
export async function insertMany(items: NewNotification[]): Promise<number> {
  if (items.length === 0) return 0;
  const now = new Date();
  try {
    const result = await (
      await notifications()
    ).insertMany(
      items.map((i) => ({ _id: new ObjectId(), createdAt: now, ...i })),
      { ordered: false },
    );
    return result.insertedCount;
  } catch (err) {
    if (
      err instanceof MongoBulkWriteError &&
      err.writeErrors &&
      [err.writeErrors].flat().every((e) => (e as { code?: number }).code === 11000)
    )
      return err.insertedCount;
    throw err;
  }
}

type Recipient = { type: "member" | "vendor"; id: string };
const who = (r: Recipient) => ({ recipientType: r.type, recipientId: new ObjectId(r.id) });

export async function listFor(r: Recipient, limit: number): Promise<NotificationDoc[]> {
  if (!ObjectId.isValid(r.id)) return [];
  return (await notifications())
    .find(who(r), { sort: { createdAt: -1, _id: -1 }, limit })
    .toArray();
}

export async function countUnread(r: Recipient): Promise<number> {
  if (!ObjectId.isValid(r.id)) return 0;
  return (await notifications()).countDocuments({ ...who(r), readAt: { $exists: false } });
}

export async function markRead(r: Recipient, id: string): Promise<void> {
  if (!ObjectId.isValid(r.id) || !ObjectId.isValid(id)) return;
  await (
    await notifications()
  ).updateOne(
    { ...who(r), _id: new ObjectId(id), readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
}

export async function markAllRead(r: Recipient): Promise<void> {
  if (!ObjectId.isValid(r.id)) return;
  await (
    await notifications()
  ).updateMany({ ...who(r), readAt: { $exists: false } }, { $set: { readAt: new Date() } });
}
