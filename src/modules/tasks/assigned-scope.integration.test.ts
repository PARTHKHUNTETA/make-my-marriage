import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): the "tasks assigned to me" scope, enforced in the queries.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("tasks assigned to me, against MongoDB", () => {
  let svc: typeof import("./service");
  let schema: typeof import("./schema");
  let db: Db;
  const w = new ObjectId();
  const W = w.toHexString();
  const me = new ObjectId().toHexString();
  const other = new ObjectId().toHexString();
  const mine = { onlyAssignedTo: me };
  let myTask = "";
  let theirTask = "";

  const input = (title: string, assignedMemberId?: string) =>
    schema.taskInputSchema.parse({ title, status: "todo", priority: "medium", assignedMemberId });

  beforeAll(async () => {
    svc = await import("./service");
    schema = await import("./schema");
    db = await (await import("@/lib/db")).getDb();
    myTask = (await svc.createTask(W, input("Book the band", me))).id;
    theirTask = (await svc.createTask(W, input("Order flowers", other))).id;
    await svc.createTask(W, input("Nobody's yet"));
  });
  afterAll(async () => {
    if (db) await db.collection("tasks").deleteMany({ weddingId: w });
  });

  it("lists and reads only my tasks, whatever the filters ask for", async () => {
    const list = await svc.listTasks(W, { view: "all" }, me, mine);
    expect(list.map((t) => t.title)).toEqual(["Book the band"]);
    const asked = await svc.listTasks(W, { view: "all", assignee: other }, me, mine);
    expect(asked.map((t) => t.title)).toEqual(["Book the band"]);
    expect(await svc.getTask(W, theirTask, mine)).toBeNull();
    expect(await svc.getTask(W, myTask, mine)).not.toBeNull();
    // without the scope, everything is there
    expect(await svc.listTasks(W, { view: "all" }, me)).toHaveLength(3);
  });

  it("cannot change, complete or delete someone else's task", async () => {
    await expect(svc.updateTask(W, theirTask, input("Mine now", me), mine)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(svc.changeTaskStatus(W, theirTask, "completed", mine)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(svc.deleteTask(W, theirTask, mine)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await svc.getTask(W, theirTask))?.title).toBe("Order flowers");
  });

  it("can work on my own", async () => {
    await svc.changeTaskStatus(W, myTask, "completed", mine);
    expect((await svc.getTask(W, myTask))?.status).toBe("completed");
    await svc.deleteTask(W, myTask, mine);
    expect(await svc.getTask(W, myTask)).toBeNull();
  });
});
