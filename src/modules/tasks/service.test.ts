import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  countByEvent: vi.fn(),
  countForEvent: vi.fn(),
  deleteTask: vi.fn(),
  findTask: vi.fn(),
  insertTask: vi.fn(),
  listTasks: vi.fn(),
  replaceTaskFields: vi.fn(),
  setStatus: vi.fn(),
  unsetAssignee: vi.fn(),
  unsetEvent: vi.fn(),
}));
vi.mock("./repository", () => repo);

import type { TaskDoc } from "./repository";
import { createTask, isOverdue, listTasks, sortByDueDate, updateTask } from "./service";
import { parseTaskQuery, taskInputSchema } from "./schema";

const doc = (over: Partial<TaskDoc> = {}): TaskDoc => ({
  _id: new ObjectId(),
  weddingId: new ObjectId(),
  title: "Book band",
  status: "todo",
  priority: "medium",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});
// Midnight IST on the given day, as the app stores due dates.
const due = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);

beforeEach(() => Object.values(repo).forEach((fn) => fn.mockReset()));

describe("isOverdue", () => {
  const now = new Date("2026-06-10T09:00:00+05:30");
  it("is true once the due day has passed and the task is not completed", () => {
    expect(isOverdue({ status: "todo", dueDate: due("2026-06-09") }, now)).toBe(true);
    expect(isOverdue({ status: "in_progress", dueDate: due("2026-01-01") }, now)).toBe(true);
  });
  it("is false on the due day itself, before it, with no date, or when completed", () => {
    expect(isOverdue({ status: "todo", dueDate: due("2026-06-10") }, now)).toBe(false);
    expect(isOverdue({ status: "todo", dueDate: due("2026-06-11") }, now)).toBe(false);
    expect(isOverdue({ status: "todo" }, now)).toBe(false);
    expect(isOverdue({ status: "completed", dueDate: due("2026-01-01") }, now)).toBe(false);
  });
  it("judges the day in India, not UTC", () => {
    // 00:30 IST on the 10th is still the 9th in UTC; the 9th is already over in India.
    expect(
      isOverdue(
        { status: "todo", dueDate: due("2026-06-09") },
        new Date("2026-06-10T00:30:00+05:30"),
      ),
    ).toBe(true);
  });
});

describe("sortByDueDate", () => {
  it("puts the earliest first and undated tasks last, keeping creation order for ties", () => {
    const a = doc({ title: "a", dueDate: due("2026-09-15") });
    const b = doc({ title: "b" });
    const c = doc({ title: "c", dueDate: due("2026-08-01") });
    const d = doc({ title: "d", createdAt: new Date("2026-02-01") });
    expect(sortByDueDate([a, b, c, d]).map((t) => t.title)).toEqual(["c", "a", "b", "d"]);
  });
});

describe("listTasks views", () => {
  beforeEach(() => repo.listTasks.mockResolvedValue([]));
  const call = (query: Parameters<typeof parseTaskQuery>[0]) =>
    listTasks("w1", parseTaskQuery(query), "m1").then(() => repo.listTasks.mock.calls[0]![1]);

  it("all: no status restriction", async () => {
    const filter = await call({});
    expect(filter.status).toBeUndefined();
    expect(filter.notStatus).toBeUndefined();
  });
  it("mine: only my tasks, not completed ones", async () => {
    expect(await call({ view: "mine" })).toMatchObject({
      assignedMemberId: "m1",
      notStatus: "completed",
    });
  });
  it("by-event: every status, grouped by the page", async () => {
    const filter = await call({ view: "by-event" });
    expect(filter.status).toBeUndefined();
    expect(filter.notStatus).toBeUndefined();
  });
  it("completed: only completed", async () => {
    expect(await call({ view: "completed" })).toMatchObject({ status: "completed" });
  });
  it("filters map through, and 'none' means unassigned / no event", async () => {
    const filter = await call({
      priority: "high",
      assignee: "none",
      eventId: "507f1f77bcf86cd799439011",
    });
    expect(filter).toMatchObject({
      priority: "high",
      assignedMemberId: null,
      eventId: "507f1f77bcf86cd799439011",
    });
    repo.listTasks.mockClear();
    expect((await call({ eventId: "none" })).eventId).toBeNull();
  });
});

describe("saving", () => {
  const input = (over = {}) => taskInputSchema.parse({ title: "Book band", ...over });

  it("stores the due date as midnight in India and defaults to To do / Medium", async () => {
    repo.insertTask.mockImplementation(async (_w, fields) => doc(fields));
    await createTask("w1", input({ dueDate: "2026-09-15" }));
    const fields = repo.insertTask.mock.calls[0]![1];
    expect(fields.dueDate.toISOString()).toBe("2026-09-14T18:30:00.000Z");
    expect(fields).toMatchObject({ status: "todo", priority: "medium" });
  });

  it("removes optional fields that were cleared instead of storing them empty", async () => {
    repo.replaceTaskFields.mockResolvedValue(doc());
    await updateTask("w1", "507f1f77bcf86cd799439011", input());
    expect(repo.replaceTaskFields.mock.calls[0]![3]).toEqual([
      "description",
      "dueDate",
      "assignedMemberId",
      "eventId",
    ]);
  });

  it("reports NOT_FOUND for a task that does not exist in this wedding", async () => {
    repo.replaceTaskFields.mockResolvedValue(null);
    await expect(updateTask("w1", "507f1f77bcf86cd799439011", input())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("taskInputSchema", () => {
  it("needs a title and treats blank optional fields as not set", () => {
    expect(taskInputSchema.safeParse({ title: "  " }).success).toBe(false);
    const parsed = taskInputSchema.parse({
      title: "x",
      description: "",
      dueDate: "",
      assignedMemberId: "",
      eventId: "",
    });
    expect(parsed).toMatchObject({
      description: undefined,
      dueDate: undefined,
      assignedMemberId: undefined,
      eventId: undefined,
    });
  });
  it("rejects impossible dates, bad ids and unknown status", () => {
    expect(taskInputSchema.safeParse({ title: "x", dueDate: "2026-02-30" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ title: "x", eventId: "nope" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ title: "x", status: "done" }).success).toBe(false);
  });
});

describe("parseTaskQuery", () => {
  it("ignores anything it does not recognise", () => {
    expect(
      parseTaskQuery({ view: "weird", status: "x", assignee: "not-an-id", priority: ["a"] }),
    ).toEqual({
      view: "all",
      status: undefined,
      priority: undefined,
      assignee: undefined,
      eventId: undefined,
    });
  });
});
