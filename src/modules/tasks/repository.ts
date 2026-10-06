import "server-only";
import { ObjectId, type ClientSession, type Collection, type Filter } from "mongodb";
import { getDb } from "@/lib/db";
import { scoped } from "@/lib/scoped";
import type { TaskPriority, TaskStatus } from "./schema";

// All MongoDB access for the tasks module. Every query goes through scoped(), which adds the
// wedding to the filter, so one wedding can never read or change another's tasks.
export type TaskDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  title: string;
  description?: string;
  dueDate?: Date;
  status: TaskStatus;
  priority: TaskPriority;
  assignedMemberId?: ObjectId;
  eventId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskFields = Pick<
  TaskDoc,
  "title" | "description" | "dueDate" | "status" | "priority" | "assignedMemberId" | "eventId"
>;
export type OptionalTaskField = "description" | "dueDate" | "assignedMemberId" | "eventId";

let ready: Promise<Collection<TaskDoc>> | undefined;

function tasks(): Promise<Collection<TaskDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<TaskDoc>("tasks");
    await col.createIndex({ weddingId: 1, status: 1, dueDate: 1 });
    await col.createIndex({ weddingId: 1, assignedMemberId: 1 });
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

export async function insertTask(weddingId: string, fields: TaskFields): Promise<TaskDoc> {
  const now = new Date();
  const doc = { _id: new ObjectId(), ...fields, createdAt: now, updatedAt: now };
  await scoped(await tasks(), { weddingId }).insertOne(doc);
  return { ...doc, weddingId: new ObjectId(weddingId) };
}

export async function findTask(weddingId: string, id: string): Promise<TaskDoc | null> {
  const _id = oid(id);
  return _id ? scoped(await tasks(), { weddingId }).findOne({ _id }) : null;
}

// Replaces the editable fields. Optional fields left out are removed, not stored empty.
export async function replaceTaskFields(
  weddingId: string,
  id: string,
  set: Partial<TaskFields>,
  unset: OptionalTaskField[],
): Promise<TaskDoc | null> {
  const _id = oid(id);
  if (!_id) return null;
  return scoped(await tasks(), { weddingId }).findOneAndUpdate(
    { _id },
    {
      $set: { ...set, updatedAt: new Date() },
      ...(unset.length > 0 ? { $unset: Object.fromEntries(unset.map((f) => [f, ""])) } : {}),
    },
    { returnDocument: "after" },
  );
}

export async function setStatus(
  weddingId: string,
  id: string,
  status: TaskStatus,
): Promise<TaskDoc | null> {
  const _id = oid(id);
  if (!_id) return null;
  return scoped(await tasks(), { weddingId }).findOneAndUpdate(
    { _id },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
}

export async function deleteTask(weddingId: string, id: string): Promise<boolean> {
  const _id = oid(id);
  if (!_id) return false;
  const result = await scoped(await tasks(), { weddingId }).deleteOne({ _id });
  return result.deletedCount === 1;
}

export type TaskFilter = {
  status?: TaskStatus;
  notStatus?: TaskStatus;
  priority?: TaskPriority;
  assignedMemberId?: string | null; // null: unassigned
  eventId?: string | null; // null: no event
};

export async function listTasks(weddingId: string, filter: TaskFilter): Promise<TaskDoc[]> {
  const query: Filter<TaskDoc> = {};
  if (filter.status) query.status = filter.status;
  else if (filter.notStatus) query.status = { $ne: filter.notStatus };
  if (filter.priority) query.priority = filter.priority;
  if (filter.assignedMemberId === null) query.assignedMemberId = { $exists: false };
  else if (filter.assignedMemberId) {
    const id = oid(filter.assignedMemberId);
    if (!id) return [];
    query.assignedMemberId = id;
  }
  if (filter.eventId === null) query.eventId = { $exists: false };
  else if (filter.eventId) {
    const id = oid(filter.eventId);
    if (!id) return [];
    query.eventId = id;
  }
  return scoped(await tasks(), { weddingId })
    .find(query)
    .toArray();
}

// How many tasks point at each event: [{ eventId, count }].
export async function countByEvent(weddingId: string): Promise<Map<string, number>> {
  const rows = await scoped(await tasks(), { weddingId })
    .aggregate<{ _id: ObjectId; count: number }>([
      { $match: { eventId: { $exists: true } } },
      { $group: { _id: "$eventId", count: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id.toHexString(), r.count]));
}

export async function countForEvent(weddingId: string, eventId: string): Promise<number> {
  const id = oid(eventId);
  return id ? scoped(await tasks(), { weddingId }).countDocuments({ eventId: id }) : 0;
}

// Deleting an event keeps its tasks and only removes the link (PRD 5.4).
export async function unsetEvent(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<number> {
  const id = oid(eventId);
  if (!id) return 0;
  const result = await scoped(await tasks(), { weddingId }).updateMany(
    { eventId: id },
    { $unset: { eventId: "" }, $set: { updatedAt: new Date() } },
    options,
  );
  return result.modifiedCount;
}

// Removing a member unassigns their tasks (PRD 5.4).
export async function unsetAssignee(
  weddingId: string,
  memberId: string,
  options?: { session?: ClientSession },
): Promise<number> {
  const id = oid(memberId);
  if (!id) return 0;
  const result = await scoped(await tasks(), { weddingId }).updateMany(
    { assignedMemberId: id },
    { $unset: { assignedMemberId: "" }, $set: { updatedAt: new Date() } },
    options,
  );
  return result.modifiedCount;
}

// A system job, not a request: unfinished tasks with an assignee that fall due before `cutoff`,
// across every wedding. The caller works out who to tell, per wedding.
export async function findTasksDueBefore(cutoff: Date, limit: number): Promise<TaskDoc[]> {
  return (await tasks())
    .find(
      {
        status: { $ne: "completed" },
        assignedMemberId: { $exists: true },
        dueDate: { $lt: cutoff },
      },
      { sort: { dueDate: 1 }, limit },
    )
    .toArray();
}
