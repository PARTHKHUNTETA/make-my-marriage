import "server-only";
import { MongoServerError, ObjectId, type ClientSession, type Collection } from "mongodb";
import { getDb } from "@/lib/db";
import { scoped } from "@/lib/scoped";

// All MongoDB access for the check-in module, always through scoped(): one document per party per
// event, written when they arrive at the gate (db-design §8).
export type CheckInDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  eventId: ObjectId;
  guestId?: ObjectId; // unset for a walk-in who is not a known party
  walkInName?: string;
  walkIn?: boolean; // admitted although not on this event's list
  arrivedCount: number;
  checkedInByMemberId: ObjectId;
  checkedInAt: Date;
  clientKey?: string;
};

let ready: Promise<Collection<CheckInDoc>> | undefined;

function checkIns(): Promise<Collection<CheckInDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<CheckInDoc>("checkIns");
    // A party is checked in once per event: a second scan finds the first record.
    await col.createIndex(
      { weddingId: 1, eventId: 1, guestId: 1 },
      { unique: true, partialFilterExpression: { guestId: { $exists: true } } },
    );
    // And one scan, sent twice, counts once: this is what makes an offline queue safe to replay.
    await col.createIndex(
      { weddingId: 1, eventId: 1, clientKey: 1 },
      { unique: true, partialFilterExpression: { clientKey: { $exists: true } } },
    );
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

// Writes an arrival, or returns the one already on record. `created` says which.
export async function recordArrival(
  weddingId: string,
  input: {
    eventId: string;
    guestId?: string;
    walkInName?: string;
    walkIn?: boolean;
    arrivedCount: number;
    memberId: string;
    clientKey: string;
  },
): Promise<{ doc: CheckInDoc; created: boolean }> {
  const col = scoped(await checkIns(), { weddingId });
  const doc = {
    _id: new ObjectId(),
    eventId: new ObjectId(input.eventId),
    ...(input.guestId ? { guestId: new ObjectId(input.guestId) } : {}),
    ...(input.walkInName ? { walkInName: input.walkInName } : {}),
    ...(input.walkIn ? { walkIn: true } : {}),
    arrivedCount: input.arrivedCount,
    checkedInByMemberId: new ObjectId(input.memberId),
    checkedInAt: new Date(),
    clientKey: input.clientKey,
  };
  try {
    await col.insertOne(doc);
    return { doc: { ...doc, weddingId: new ObjectId(weddingId) }, created: true };
  } catch (err) {
    if (!(err instanceof MongoServerError && err.code === 11000)) throw err;
    // Already there: either this party (a second scan) or this same scan (a replay).
    const existing = await col.findOne({
      eventId: doc.eventId,
      $or: [...(doc.guestId ? [{ guestId: doc.guestId }] : []), { clientKey: input.clientKey }],
    });
    if (!existing) throw err;
    return { doc: existing, created: false };
  }
}

export async function findArrival(
  weddingId: string,
  eventId: string,
  guestId: string,
): Promise<CheckInDoc | null> {
  const [e, g] = [oid(eventId), oid(guestId)];
  return e && g
    ? scoped(await checkIns(), { weddingId }).findOne({ eventId: e, guestId: g })
    : null;
}

export async function findArrivals(
  weddingId: string,
  eventId: string,
  guestIds: string[],
): Promise<CheckInDoc[]> {
  const e = oid(eventId);
  const ids = guestIds.flatMap((g) => oid(g) ?? []);
  return e && ids.length > 0
    ? scoped(await checkIns(), { weddingId })
        .find({ eventId: e, guestId: { $in: ids } })
        .toArray()
    : [];
}

export async function arrivalTotals(
  weddingId: string,
  eventId: string,
): Promise<{ people: number; parties: number }> {
  const e = oid(eventId);
  if (!e) return { people: 0, parties: 0 };
  const [row] = await scoped(await checkIns(), { weddingId })
    .aggregate<{ people: number; parties: number }>([
      { $match: { eventId: e } },
      { $group: { _id: null, people: { $sum: "$arrivedCount" }, parties: { $sum: 1 } } },
    ])
    .toArray();
  return { people: row?.people ?? 0, parties: row?.parties ?? 0 };
}

export async function deleteArrivalsForEvent(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<void> {
  const e = oid(eventId);
  if (!e) return;
  await scoped(await checkIns(), { weddingId }).deleteMany({ eventId: e }, options);
}

export async function countArrivals(weddingId: string, eventId: string): Promise<number> {
  const e = oid(eventId);
  return e ? scoped(await checkIns(), { weddingId }).countDocuments({ eventId: e }) : 0;
}
