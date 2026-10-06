import "server-only";
import {
  MongoServerError,
  ObjectId,
  type ClientSession,
  type Collection,
  type Document,
  type UpdateFilter,
} from "mongodb";
import { getDb } from "@/lib/db";
import { scoped } from "@/lib/scoped";

// All MongoDB access for the seating module, always through scoped(). A table holds the parties
// seated at it as embedded assignments: a table has ten or so parties and is always read whole.
export type TableDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  eventId: ObjectId;
  name: string;
  capacity: number;
  assignments: Array<{ guestId: ObjectId; seats: number }>;
  createdAt: Date;
  updatedAt: Date;
};

let ready: Promise<Collection<TableDoc>> | undefined;

function tables(): Promise<Collection<TableDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<TableDoc>("seatingTables");
    // One name per table per event, whatever the capitals, so "Table 7" and "table 7" are the same.
    // (An earlier version of this index was case-sensitive; it is replaced.)
    await col.dropIndex("weddingId_1_eventId_1_name_1").catch(() => undefined);
    await col.createIndex(
      { weddingId: 1, eventId: 1, name: 1 },
      { unique: true, name: "table_name_per_event", collation: { locale: "en", strength: 2 } },
    );
    await col.createIndex({ weddingId: 1, "assignments.guestId": 1 });
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

// Null when the event already has a table with this name.
export async function insertTable(
  weddingId: string,
  input: { eventId: string; name: string; capacity: number },
): Promise<TableDoc | null> {
  const now = new Date();
  const doc = {
    _id: new ObjectId(),
    eventId: new ObjectId(input.eventId),
    name: input.name,
    capacity: input.capacity,
    assignments: [],
    createdAt: now,
    updatedAt: now,
  };
  try {
    await scoped(await tables(), { weddingId }).insertOne(doc);
    return { ...doc, weddingId: new ObjectId(weddingId) };
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) return null;
    throw err;
  }
}

export async function listTablesForEvent(weddingId: string, eventId: string): Promise<TableDoc[]> {
  const e = oid(eventId);
  if (!e) return [];
  return scoped(await tables(), { weddingId })
    .find({ eventId: e })
    .collation({ locale: "en", numericOrdering: true, strength: 2 })
    .sort({ name: 1, _id: 1 })
    .toArray();
}

export async function findTable(weddingId: string, id: string): Promise<TableDoc | null> {
  const _id = oid(id);
  return _id ? scoped(await tables(), { weddingId }).findOne({ _id }) : null;
}

// Renames or resizes a table. Returns "taken" if the name is used by another table of the event.
export async function changeTable(
  weddingId: string,
  id: string,
  set: { name: string; capacity: number },
): Promise<TableDoc | "taken" | null> {
  const _id = oid(id);
  if (!_id) return null;
  try {
    return await scoped(await tables(), { weddingId }).findOneAndUpdate(
      { _id },
      { $set: { ...set, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) return "taken";
    throw err;
  }
}

export async function deleteTable(weddingId: string, id: string): Promise<boolean> {
  const _id = oid(id);
  if (!_id) return false;
  return (await scoped(await tables(), { weddingId }).deleteOne({ _id })).deletedCount === 1;
}

// Seats a party at a table, or changes how many seats it takes there, in ONE atomic write that
// also checks the capacity. Two people seating at the same moment cannot overfill a table: the
// check and the change cannot be separated. Returns "full" when the seats would not fit.
export async function placeParty(
  weddingId: string,
  tableId: string,
  guestId: string,
  seats: number,
  options?: { session?: ClientSession },
): Promise<"ok" | "full" | "missing"> {
  const [_id, guest] = [oid(tableId), oid(guestId)];
  if (!_id || !guest) return "missing";
  const others = {
    $filter: { input: "$assignments", cond: { $ne: ["$$this.guestId", { $literal: guest }] } },
  };
  const pipeline: Document[] = [
    {
      $set: {
        assignments: {
          $concatArrays: [others, [{ guestId: { $literal: guest }, seats: { $literal: seats } }]],
        },
        updatedAt: { $literal: new Date() },
      },
    },
  ];
  const col = scoped(await tables(), { weddingId });
  const fit = {
    $expr: {
      $lte: [
        { $add: [{ $sum: { $map: { input: others, as: "a", in: "$$a.seats" } } }, seats] },
        "$capacity",
      ],
    },
  };
  const result = await col.updateOne(
    { _id, ...fit },
    pipeline as unknown as UpdateFilter<TableDoc>,
    options,
  );
  if (result.matchedCount === 1) return "ok";
  return (await col.countDocuments({ _id }, options)) === 1 ? "full" : "missing";
}

export async function removeParty(
  weddingId: string,
  tableId: string,
  guestId: string,
  options?: { session?: ClientSession },
): Promise<boolean> {
  const [_id, guest] = [oid(tableId), oid(guestId)];
  if (!_id || !guest) return false;
  const result = await scoped(await tables(), { weddingId }).updateOne(
    { _id, "assignments.guestId": guest },
    { $pull: { assignments: { guestId: guest } }, $set: { updatedAt: new Date() } },
    options,
  );
  return result.modifiedCount === 1;
}

// A deleted guest, or one taken off an event, gives up their seats.
export async function removePartyFromEvents(
  weddingId: string,
  guestId: string,
  eventIds: string[] | "all",
): Promise<void> {
  const guest = oid(guestId);
  if (!guest) return;
  const events = eventIds === "all" ? null : eventIds.flatMap((e) => oid(e) ?? []);
  if (events && events.length === 0) return;
  await scoped(await tables(), { weddingId }).updateMany(
    { "assignments.guestId": guest, ...(events ? { eventId: { $in: events } } : {}) },
    { $pull: { assignments: { guestId: guest } }, $set: { updatedAt: new Date() } },
  );
}

export async function deleteTablesForEvent(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<void> {
  const e = oid(eventId);
  if (!e) return;
  await scoped(await tables(), { weddingId }).deleteMany({ eventId: e }, options);
}

export async function countTables(weddingId: string, eventId: string): Promise<number> {
  const e = oid(eventId);
  return e ? scoped(await tables(), { weddingId }).countDocuments({ eventId: e }) : 0;
}

// The tables a party sits at, across events.
export async function tablesOfParty(weddingId: string, guestId: string): Promise<TableDoc[]> {
  const guest = oid(guestId);
  return guest
    ? scoped(await tables(), { weddingId })
        .find({ "assignments.guestId": guest })
        .collation({ locale: "en", numericOrdering: true, strength: 2 })
        .sort({ name: 1 })
        .toArray()
    : [];
}
