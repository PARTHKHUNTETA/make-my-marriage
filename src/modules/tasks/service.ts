import type { ClientSession } from "mongodb";
import { ObjectId } from "mongodb";
import { istDate, toIstYmd } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import {
  countByEvent,
  countForEvent,
  deleteTask as removeTask,
  findTask,
  insertTask,
  listTasks as findTasks,
  replaceTaskFields,
  setStatus,
  unsetAssignee,
  unsetEvent,
  type OptionalTaskField,
  type TaskDoc,
  type TaskFields,
  type TaskFilter,
} from "./repository";
import type { TaskInput, TaskItem, TaskQuery, TaskStatus } from "./schema";

// Business rules for the tasks module (PRD 5.4). The only caller of its repository, and the only
// way other modules reach this one. Whether the event and the assignee really belong to this
// wedding is checked by the Server Action before it calls in here (modules do not import each
// other's internals), so these functions trust the ids they are given.

const NOT_FOUND = new AppError("NOT_FOUND", "That task no longer exists.");

export function toItem(doc: TaskDoc, now: Date = new Date()): TaskItem {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    description: doc.description,
    dueDate: doc.dueDate,
    status: doc.status,
    priority: doc.priority,
    assignedMemberId: doc.assignedMemberId?.toHexString(),
    eventId: doc.eventId?.toHexString(),
    overdue: isOverdue(doc, now),
  };
}

// A task is overdue once its due day (in India) has passed and it is not completed. A task due
// today is not overdue yet.
export function isOverdue(
  task: Pick<TaskDoc, "status" | "dueDate">,
  now: Date = new Date(),
): boolean {
  return task.status !== "completed" && !!task.dueDate && toIstYmd(task.dueDate) < toIstYmd(now);
}

// Earliest due date first, tasks without a date last, ties in the order they were created.
export function sortByDueDate(tasks: TaskDoc[]): TaskDoc[] {
  return [...tasks].sort((a, b) => {
    const ad = a.dueDate?.getTime() ?? Infinity;
    const bd = b.dueDate?.getTime() ?? Infinity;
    return ad !== bd ? (ad < bd ? -1 : 1) : a.createdAt.getTime() - b.createdAt.getTime();
  });
}

function toFields(input: TaskInput): { set: TaskFields; unset: OptionalTaskField[] } {
  const set: TaskFields = {
    title: input.title,
    status: input.status,
    priority: input.priority,
  };
  const unset: OptionalTaskField[] = [];
  if (input.description) set.description = input.description;
  else unset.push("description");
  if (input.dueDate) {
    const due = istDate(input.dueDate);
    if (!due) throw new AppError("VALIDATION_FAILED", "Enter a valid date");
    set.dueDate = due;
  } else unset.push("dueDate");
  if (input.assignedMemberId) set.assignedMemberId = new ObjectId(input.assignedMemberId);
  else unset.push("assignedMemberId");
  if (input.eventId) set.eventId = new ObjectId(input.eventId);
  else unset.push("eventId");
  return { set, unset };
}

export async function createTask(weddingId: string, input: TaskInput): Promise<TaskItem> {
  const { set } = toFields(input);
  return toItem(await insertTask(weddingId, set));
}

export async function updateTask(
  weddingId: string,
  taskId: string,
  input: TaskInput,
): Promise<TaskItem> {
  const { set, unset } = toFields(input);
  const doc = await replaceTaskFields(weddingId, taskId, set, unset);
  if (!doc) throw NOT_FOUND;
  return toItem(doc);
}

export async function changeTaskStatus(
  weddingId: string,
  taskId: string,
  status: TaskStatus,
): Promise<TaskItem> {
  const doc = await setStatus(weddingId, taskId, status);
  if (!doc) throw NOT_FOUND;
  return toItem(doc);
}

export async function deleteTask(weddingId: string, taskId: string): Promise<void> {
  if (!(await removeTask(weddingId, taskId))) throw NOT_FOUND;
}

export async function getTask(weddingId: string, taskId: string): Promise<TaskItem | null> {
  const doc = await findTask(weddingId, taskId);
  return doc ? toItem(doc) : null;
}

// The four views from PRD 5.4 plus the filters. "My tasks" needs the caller's member id.
export async function listTasks(
  weddingId: string,
  query: TaskQuery,
  currentMemberId: string,
): Promise<TaskItem[]> {
  const filter: TaskFilter = {
    status: query.status,
    priority: query.priority,
    assignedMemberId:
      query.view === "mine" ? currentMemberId : query.assignee === "none" ? null : query.assignee,
    eventId: query.eventId === "none" ? null : query.eventId,
  };
  if (query.view === "completed") filter.status = "completed";
  // "My tasks" is the work still to do; every other view shows all statuses unless one was picked.
  else if (!query.status && query.view === "mine") filter.notStatus = "completed";

  const now = new Date();
  const docs = sortByDueDate(await findTasks(weddingId, filter));
  return docs.map((d) => toItem(d, now));
}

export function taskCountsByEvent(weddingId: string): Promise<Map<string, number>> {
  return countByEvent(weddingId);
}

export function taskCountForEvent(weddingId: string, eventId: string): Promise<number> {
  return countForEvent(weddingId, eventId);
}

// Called by the events module when an event is deleted, inside its transaction.
export function unlinkEvent(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<number> {
  return unsetEvent(weddingId, eventId, options);
}

// Called by the members module when a member is removed.
export function unassignMember(
  weddingId: string,
  memberId: string,
  options?: { session?: ClientSession },
): Promise<number> {
  return unsetAssignee(weddingId, memberId, options);
}
