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

  describe("the rules that keep roles safe", () => {
    let roles: typeof import("./roles");
    let perms: typeof import("@/lib/permissions");
    const W2 = new ObjectId();
    const w2 = W2.toHexString();
    const ids = { admin: "", manager: "", helper: "" };
    const member = async (roleIds: string[]) => {
      const _id = new ObjectId();
      await db.collection("weddingMembers").insertOne({
        _id,
        weddingId: W2,
        userId: new ObjectId(),
        role: roleIds.includes("admin") ? "admin" : "manager",
        roleIds,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return _id.toHexString();
    };
    const set = (role: keyof typeof perms.BUILT_IN_ROLES) =>
      perms.mergeGrants([perms.BUILT_IN_ROLES[role].grants]);

    beforeAll(async () => {
      roles = await import("./roles");
      perms = await import("@/lib/permissions");
      ids.admin = await member(["admin"]);
      ids.manager = await member(["manager"]);
      ids.helper = await member(["viewer"]);
    });
    afterAll(async () => {
      await db.collection("weddingMembers").deleteMany({ weddingId: W2 });
      await db.collection("weddingRoles").deleteMany({ weddingId: W2 });
      await db.collection("memberInvites").deleteMany({ weddingId: W2 });
    });

    it("nobody can make a role that does more than they can", async () => {
      await expect(
        roles.createRole(w2, set("manager"), { name: "Sneaky", grants: ["wedding.delete"] }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        roles.createRole(w2, set("manager"), { name: "Helpers", grants: ["guest.edit"] }),
      ).resolves.toMatchObject({ name: "Helpers" });
    });

    it("nobody changes their own roles, or those of someone who can do more", async () => {
      await expect(
        roles.setMemberRoles({
          weddingId: w2,
          actor: { memberId: ids.manager, permissions: set("manager") },
          memberId: ids.manager,
          roleIds: ["admin"],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      // a manager cannot touch the admin, even to give them less
      await expect(
        roles.setMemberRoles({
          weddingId: w2,
          actor: { memberId: ids.manager, permissions: set("manager") },
          memberId: ids.admin,
          roleIds: ["viewer"],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      // nor hand out admin
      await expect(
        roles.setMemberRoles({
          weddingId: w2,
          actor: { memberId: ids.manager, permissions: set("manager") },
          memberId: ids.helper,
          roleIds: ["admin"],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("a role from another wedding cannot be given", async () => {
      const foreign = await (
        await import("./repository")
      ).insertWeddingRole(A, {
        name: "Foreign",
        grants: ["event.view"],
      });
      await expect(
        roles.setMemberRoles({
          weddingId: w2,
          actor: { memberId: ids.admin, permissions: set("admin") },
          memberId: ids.helper,
          roleIds: [foreign!._id.toHexString()],
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    });

    it("a custom role that can manage the team makes its holders admins, and cannot lose that while it is the only one", async () => {
      const lead = await roles.createRole(w2, set("admin"), {
        name: "Team lead",
        grants: ["member.view", "member.manage"],
      });
      await roles.setMemberRoles({
        weddingId: w2,
        actor: { memberId: ids.admin, permissions: set("admin") },
        memberId: ids.helper,
        roleIds: [lead.id],
      });
      const legacy = async (id: string) =>
        (await db.collection("weddingMembers").findOne({ _id: new ObjectId(id) }))?.role;
      expect(await legacy(ids.helper)).toBe("admin");

      // the built-in admin steps down (changed by the team lead): the lead still manages the team
      await roles.setMemberRoles({
        weddingId: w2,
        actor: { memberId: ids.helper, permissions: set("admin") },
        memberId: ids.admin,
        roleIds: ["manager"],
      });
      // now the lead role is the only way to manage the team, so it cannot lose that
      await expect(
        roles.updateRole(w2, set("admin"), lead.id, { name: "Team lead", grants: ["member.view"] }),
      ).rejects.toMatchObject({ code: "LAST_ADMIN" });
      // and it cannot be deleted while someone has it
      await expect(roles.deleteRole(w2, lead.id)).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
      });
    });

    it("built-in roles cannot be changed or deleted", async () => {
      await expect(
        roles.updateRole(w2, set("admin"), "admin", { name: "x", grants: ["event.view"] }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(roles.deleteRole(w2, "viewer")).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("someone joining by an old invitation for a since-deleted role joins as a Viewer", async () => {
      const gone = await roles.createRole(w2, set("admin"), {
        name: "Temp",
        grants: ["event.edit"],
      });
      await roles.deleteRole(w2, gone.id);
      expect(await roles.rolesForJoining(w2, [gone.id])).toEqual({
        roleIds: ["viewer"],
        role: "manager",
      });
      expect(await roles.rolesForJoining(w2, undefined)).toEqual({
        roleIds: ["manager"],
        role: "manager",
      });
    });
  });
});
