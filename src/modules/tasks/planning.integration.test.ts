import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): events and tasks on the real database, using two
// throwaway weddings that are removed afterwards. No emails are sent.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn().mockResolvedValue(undefined) }));

describe.skipIf(!enabled)("events and tasks against MongoDB", () => {
  let tasks: typeof import("./service");
  let events: typeof import("@/modules/events/service");
  let members: typeof import("@/modules/members/service");
  let schema: typeof import("./schema");
  let eventSchema: typeof import("@/modules/events/schema");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();

  const task = (over: Record<string, unknown> = {}) =>
    schema.taskInputSchema.parse({ title: "Book band", ...over });
  const event = (over: Record<string, unknown> = {}) =>
    eventSchema.eventInputSchema.parse({
      type: "mehndi",
      name: "Mehndi",
      date: "2027-02-12",
      startTime: "16:00",
      ...over,
    });

  beforeAll(async () => {
    tasks = await import("./service");
    events = await import("@/modules/events/service");
    members = await import("@/modules/members/service");
    schema = await import("./schema");
    eventSchema = await import("@/modules/events/schema");
    db = await (await import("@/lib/db")).getDb();
    // Creates the collections and indexes before a transaction needs them.
    await events.listEvents(A);
    await tasks.listTasks(A, { view: "all" }, new ObjectId().toHexString());
    await members.getMembership(new ObjectId().toHexString());
  });
  afterAll(async () => {
    if (!db) return;
    for (const name of ["events", "tasks", "weddingMembers"])
      await db.collection(name).deleteMany({ weddingId: { $in: [wA, wB] } });
  });

  it("one wedding never sees or changes another wedding's events and tasks", async () => {
    const e = await events.createEvent(A, event());
    const t = await tasks.createTask(A, task());
    expect(await events.listEvents(B)).toEqual([]);
    expect(await events.getEvent(B, e.id)).toBeNull();
    expect(await tasks.listTasks(B, { view: "all" }, "m")).toEqual([]);
    expect(await tasks.getTask(B, t.id)).toBeNull();

    await expect(tasks.changeTaskStatus(B, t.id, "completed")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(tasks.deleteTask(B, t.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(events.updateEvent(B, e.id, event({ name: "Hijacked" }))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(events.deleteEvent(B, e.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await events.getEvent(A, e.id))?.name).toBe("Mehndi");
    expect((await tasks.getTask(A, t.id))?.status).toBe("todo");
  });

  it("lists events in date order, then start time", async () => {
    await db.collection("events").deleteMany({ weddingId: wA });
    await events.createEvent(A, event({ name: "Wedding", date: "2027-02-14", startTime: "10:00" }));
    await events.createEvent(
      A,
      event({ name: "Sangeet late", date: "2027-02-13", startTime: "20:00" }),
    );
    await events.createEvent(
      A,
      event({ name: "Sangeet early", date: "2027-02-13", startTime: "18:00" }),
    );
    await events.createEvent(A, event({ name: "Engagement", date: "2026-11-01" }));
    expect((await events.listEvents(A)).map((e) => e.name)).toEqual([
      "Engagement",
      "Sangeet early",
      "Sangeet late",
      "Wedding",
    ]);
  });

  it("deleting an event removes it and keeps its tasks, unlinked", async () => {
    const e = await events.createEvent(A, event({ name: "Haldi", type: "haldi" }));
    const linked = await tasks.createTask(A, task({ title: "Order flowers", eventId: e.id }));
    const other = await tasks.createTask(A, task({ title: "Unrelated" }));
    expect(await events.previewEventDelete(A, e.id)).toEqual({ taskCount: 1, guestCount: 0 });

    await events.deleteEvent(A, e.id);

    expect(await events.getEvent(A, e.id)).toBeNull();
    const kept = await tasks.getTask(A, linked.id);
    expect(kept).toMatchObject({ title: "Order flowers" });
    expect(kept?.eventId).toBeUndefined();
    expect(
      await db.collection("tasks").findOne({ _id: new ObjectId(linked.id) }),
    ).not.toHaveProperty("eventId");
    expect((await tasks.getTask(A, other.id))?.title).toBe("Unrelated");
  });

  it("deleting an event in one wedding does not unlink tasks in another", async () => {
    const eventId = new ObjectId();
    // A task in wedding B that (impossibly, but defensively) carries wedding A's event id.
    await db.collection("tasks").insertOne({
      _id: new ObjectId(),
      weddingId: wB,
      title: "Foreign",
      status: "todo",
      priority: "low",
      eventId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.collection("events").insertOne({
      _id: eventId,
      weddingId: wA,
      type: "custom",
      name: "Temp",
      date: new Date(),
      startTime: "10:00",
      showOnWebsite: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await events.deleteEvent(A, eventId.toHexString());
    expect(
      await db.collection("tasks").findOne({ weddingId: wB, title: "Foreign" }),
    ).toHaveProperty("eventId");
  });

  it("removing a member unassigns their tasks and leaves everyone else's alone", async () => {
    const mk = async (role: "admin" | "manager") => {
      const _id = new ObjectId();
      await db.collection("weddingMembers").insertOne({
        _id,
        weddingId: wA,
        userId: new ObjectId(),
        role,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return _id.toHexString();
    };
    const [admin, manager] = [await mk("admin"), await mk("manager")];
    const mine = await tasks.createTask(A, task({ title: "Mine", assignedMemberId: manager }));
    const theirs = await tasks.createTask(A, task({ title: "Theirs", assignedMemberId: admin }));

    await members.removeMember({ weddingId: A, memberId: manager });

    expect((await tasks.getTask(A, mine.id))?.assignedMemberId).toBeUndefined();
    expect((await tasks.getTask(A, theirs.id))?.assignedMemberId).toBe(admin);
    expect(await members.memberExists(A, manager)).toBe(false);
  });

  it("a refused removal (last admin) leaves tasks assigned", async () => {
    await db.collection("weddingMembers").deleteMany({ weddingId: wA });
    const _id = new ObjectId();
    await db.collection("weddingMembers").insertOne({
      _id,
      weddingId: wA,
      userId: new ObjectId(),
      role: "admin",
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const t = await tasks.createTask(A, task({ assignedMemberId: _id.toHexString() }));
    await expect(
      members.removeMember({ weddingId: A, memberId: _id.toHexString() }),
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });
    expect((await tasks.getTask(A, t.id))?.assignedMemberId).toBe(_id.toHexString());
  });

  it("filters, views and sort order work against real data", async () => {
    await db.collection("tasks").deleteMany({ weddingId: wA });
    const m = new ObjectId().toHexString();
    const e = await events.createEvent(A, event({ name: "Filter event" }));
    await tasks.createTask(A, task({ title: "late", dueDate: "2020-01-01", priority: "high" }));
    await tasks.createTask(A, task({ title: "undated", assignedMemberId: m }));
    await tasks.createTask(A, task({ title: "future", dueDate: "2099-01-01", eventId: e.id }));
    await tasks.createTask(
      A,
      task({ title: "finished", status: "completed", assignedMemberId: m }),
    );
    const list = async (query: Partial<import("./schema").TaskQuery>) =>
      (await tasks.listTasks(A, { view: "all", ...query }, m)).map((t) => t.title);

    expect(await list({})).toEqual(["late", "future", "undated", "finished"]);
    expect(await list({ view: "mine" })).toEqual(["undated"]);
    expect(await list({ view: "completed" })).toEqual(["finished"]);
    expect(await list({ priority: "high" })).toEqual(["late"]);
    expect(await list({ eventId: e.id })).toEqual(["future"]);
    expect(await list({ eventId: "none" })).toEqual(["late", "undated", "finished"]);
    expect(await list({ assignee: "none" })).toEqual(["late", "future"]);
    const all = await tasks.listTasks(A, { view: "all" }, m);
    expect(all.find((t) => t.title === "late")?.overdue).toBe(true);
    expect(all.find((t) => t.title === "future")?.overdue).toBe(false);
    expect(await list({ status: "in_progress" })).toEqual([]);
    expect((await tasks.taskCountsByEvent(A)).get(e.id)).toBe(1);
  });

  it("clearing optional task fields removes them from the stored document", async () => {
    const e = await events.createEvent(A, event());
    const t = await tasks.createTask(
      A,
      task({ description: "x", dueDate: "2027-01-01", eventId: e.id }),
    );
    await tasks.updateTask(A, t.id, task());
    const stored = await db.collection("tasks").findOne({ _id: new ObjectId(t.id) });
    for (const field of ["description", "dueDate", "eventId", "assignedMemberId"])
      expect(stored).not.toHaveProperty(field);
  });
});
