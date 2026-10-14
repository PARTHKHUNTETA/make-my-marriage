import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): roles and permissions on the real database.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("roles against MongoDB", () => {
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();
  const legacyUser = new ObjectId();

  beforeAll(async () => {
    db = await (await import("@/lib/db")).getDb();
    // A member from before roles existed: only the old `role` field.
    await db.collection("weddingMembers").insertOne({
      _id: new ObjectId(),
      weddingId: wA,
      userId: legacyUser,
      role: "admin",
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
  afterAll(async () => {
    if (!db) return;
    await db.collection("weddingMembers").deleteMany({ weddingId: { $in: [wA, wB] } });
    await db.collection("weddingRoles").deleteMany({ weddingId: { $in: [wA, wB] } });
  });

  it("gives members from before roles existed the role they had", async () => {
    vi.resetModules(); // a fresh module runs the collection's one-time setup, as a new server would
    const svc = await import("./service");
    const m = await svc.getMembership(legacyUser.toHexString());
    expect(m?.roleIds).toEqual(["admin"]);
    const raw = await db.collection("weddingMembers").findOne({ userId: legacyUser });
    expect(raw?.roleIds).toEqual(["admin"]);
    expect(m?.permissions["wedding.delete"]).toBe("wedding");
  });

  it("stores custom roles per wedding, with names unique per wedding ignoring case", async () => {
    const repo = await import("./repository");
    const r = await repo.insertWeddingRole(A, { name: "Groom's family", grants: ["guest.view"] });
    expect(r).not.toBeNull();
    expect(await repo.insertWeddingRole(A, { name: "groom's FAMILY", grants: [] })).toBeNull();
    // the same name is fine in another wedding
    expect(await repo.insertWeddingRole(B, { name: "Groom's family", grants: [] })).not.toBeNull();
  });

  it("a role id from another wedding grants nothing", async () => {
    const repo = await import("./repository");
    const svc = await import("./service");
    const inB = await repo.insertWeddingRole(B, { name: "Money", grants: ["expense.edit"] });
    const inA = await repo.insertWeddingRole(A, { name: "Tasks", grants: ["task.edit@assigned"] });
    const set = await svc.resolvePermissions(A, [inB!._id.toHexString(), inA!._id.toHexString()]);
    expect(set).toEqual({ "task.edit": "assigned" });
  });

  it("editing returns the role as it was, and refuses a name in use", async () => {
    const repo = await import("./repository");
    const role = await repo.insertWeddingRole(A, { name: "Helpers", grants: ["event.view"] });
    const id = role!._id.toHexString();
    const before = await repo.updateWeddingRole(A, id, {
      name: "Helpers",
      description: "Cousins",
      grants: ["event.view", "event.edit"],
    });
    expect(before).toMatchObject({ grants: ["event.view"] });
    expect(await repo.updateWeddingRole(A, id, { name: "tasks", grants: [] })).toBe("taken");
    expect(await repo.updateWeddingRole(B, id, { name: "x", grants: [] })).toBeNull(); // other wedding
    const after = (await repo.findWeddingRoles(A, [id]))[0];
    expect(after).toMatchObject({ description: "Cousins", grants: ["event.view", "event.edit"] });
  });
});
