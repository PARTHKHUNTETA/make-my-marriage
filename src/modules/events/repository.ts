import "server-only";
import { ObjectId, type ClientSession, type Collection } from "mongodb";
import { getDb } from "@/lib/db";
import { scoped } from "@/lib/scoped";
import type { EventType } from "./schema";

// All MongoDB access for the events module, always through scoped().
export type EventDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  type: EventType;
  name: string;
  date: Date;
  startTime: string;
  endTime?: string;
  venueName?: string;
  address?: string;
  description?: string;
  dressCode?: string;
  coverImageKey?: string;
  showOnWebsite: boolean;
  // Whether guests see "Your table" on their invitation page (off by default; set from Seating).
  showTable?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type EventFields = Pick<
  EventDoc,
  | "type"
  | "name"
  | "date"
  | "startTime"
  | "endTime"
  | "venueName"
  | "address"
  | "description"
  | "dressCode"
  | "showOnWebsite"
>;
export type OptionalEventField = "endTime" | "venueName" | "address" | "description" | "dressCode";

let ready: Promise<Collection<EventDoc>> | undefined;

function events(): Promise<Collection<EventDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<EventDoc>("events");
    await col.createIndex({ weddingId: 1, date: 1 });
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

export async function insertEvent(weddingId: string, fields: EventFields): Promise<EventDoc> {
  const now = new Date();
  const doc = { _id: new ObjectId(), ...fields, createdAt: now, updatedAt: now };
  await scoped(await events(), { weddingId }).insertOne(doc);
  return { ...doc, weddingId: new ObjectId(weddingId) };
}

export async function listEvents(weddingId: string): Promise<EventDoc[]> {
  return scoped(await events(), { weddingId })
    .find({})
    .sort({ date: 1, startTime: 1 })
    .toArray();
}

export async function findEvent(weddingId: string, id: string): Promise<EventDoc | null> {
  const _id = oid(id);
  return _id ? scoped(await events(), { weddingId }).findOne({ _id }) : null;
}

export async function replaceEventFields(
  weddingId: string,
  id: string,
  set: Partial<EventFields>,
  unset: OptionalEventField[],
): Promise<EventDoc | null> {
  const _id = oid(id);
  if (!_id) return null;
  return scoped(await events(), { weddingId }).findOneAndUpdate(
    { _id },
    {
      $set: { ...set, updatedAt: new Date() },
      ...(unset.length > 0 ? { $unset: Object.fromEntries(unset.map((f) => [f, ""])) } : {}),
    },
    { returnDocument: "after" },
  );
}

export async function deleteEvent(
  weddingId: string,
  id: string,
  options?: { session?: ClientSession },
): Promise<boolean> {
  const _id = oid(id);
  if (!_id) return false;
  const result = await scoped(await events(), { weddingId }).deleteOne({ _id }, options);
  return result.deletedCount === 1;
}

// Turns "show guests their table" on or off for one event. Not part of the event form.
export async function setShowTable(weddingId: string, id: string, on: boolean): Promise<boolean> {
  const _id = oid(id);
  if (!_id) return false;
  const result = await scoped(await events(), { weddingId }).updateOne(
    { _id },
    { $set: { showTable: on, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}
