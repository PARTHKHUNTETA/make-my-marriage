import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): exercises team management on the real database with a
// throwaway wedding and throwaway accounts, all removed afterwards. No emails are sent.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn().mockResolvedValue(undefined) }));

describe.skipIf(!enabled)("team management against MongoDB", () => {
  let svc: typeof import("./service");
  let db: Db;
  const tag = `zz-team-${Date.now()}`;
  const weddingId = new ObjectId();
  const userIds: ObjectId[] = [];

  const addUser = async (label: string) => {
    const _id = new ObjectId();
    userIds.push(_id);
    await db.collection("users").insertOne({
      _id,
      name: label,
      email: `${tag}-${label}@example.com`,
      passwordHash: "x",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return _id;
  };
  const addMember = async (userId: ObjectId, role: "admin" | "manager") => {
    const _id = new ObjectId();
    await db.collection("weddingMembers").insertOne({
      _id,
      weddingId,
      userId,
      role,
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return _id.toHexString();
  };
  const roleOf = async (memberId: string) =>
    (await db.collection("weddingMembers").findOne({ _id: new ObjectId(memberId) }))?.role;
  const adminCount = () =>
    db.collection("weddingMembers").countDocuments({ weddingId, role: "admin" });

  beforeAll(async () => {
    svc = await import("./service");
    const { getDb } = await import("@/lib/db");
    db = await getDb();
    // Make sure the indexes (including unique userId) exist before the tests rely on them.
    await svc.getMembership(new ObjectId().toHexString());
    await svc.previewInvite("warm-up-token-123456");
  });

  afterAll(async () => {
    if (!db) return;
    await db.collection("weddingMembers").deleteMany({ weddingId });
    await db.collection("memberInvites").deleteMany({ weddingId });
    await db.collection("users").deleteMany({ _id: { $in: userIds } });
    await db.collection("users").deleteMany({ email: new RegExp(`^${tag}`) });
    await db.collection("emailQueue").deleteMany({ toEmail: new RegExp(`^${tag}`) });
  });

  it("two admins demoting each other at the same moment never leave the wedding with none", async () => {
    // Repeated, because the race only shows up some of the time.
    for (let round = 0; round < 6; round++) {
      await db.collection("weddingMembers").deleteMany({ weddingId });
      const [a, b] = [
        await addMember(await addUser(`a${round}`), "admin"),
        await addMember(await addUser(`b${round}`), "admin"),
      ];

      const results = await Promise.allSettled([
        svc.changeMemberRole({ weddingId: weddingId.toHexString(), memberId: a, role: "manager" }),
        svc.changeMemberRole({ weddingId: weddingId.toHexString(), memberId: b, role: "manager" }),
      ]);

      expect(await adminCount()).toBe(1);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(failure.reason).toMatchObject({ code: "LAST_ADMIN" });
    }
  });

  it("two admins removing each other at the same moment never leave the wedding with none", async () => {
    for (let round = 0; round < 6; round++) {
      await db.collection("weddingMembers").deleteMany({ weddingId });
      const [a, b] = [
        await addMember(await addUser(`ra${round}`), "admin"),
        await addMember(await addUser(`rb${round}`), "admin"),
      ];

      const results = await Promise.allSettled([
        svc.removeMember({ weddingId: weddingId.toHexString(), memberId: a }),
        svc.removeMember({ weddingId: weddingId.toHexString(), memberId: b }),
      ]);

      expect(await adminCount()).toBe(1);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    }
  });

  it("the last admin cannot be demoted or removed, but a manager can be promoted first", async () => {
    await db.collection("weddingMembers").deleteMany({ weddingId });
    const admin = await addMember(await addUser("sole-admin"), "admin");
    const manager = await addMember(await addUser("helper"), "manager");
    const w = weddingId.toHexString();

    await expect(
      svc.changeMemberRole({ weddingId: w, memberId: admin, role: "manager" }),
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });
    await expect(svc.removeMember({ weddingId: w, memberId: admin })).rejects.toMatchObject({
      code: "LAST_ADMIN",
    });

    await svc.changeMemberRole({ weddingId: w, memberId: manager, role: "admin" });
    expect(await roleOf(manager)).toBe("admin");
    await svc.removeMember({ weddingId: w, memberId: admin }); // fine now: another admin remains
    expect(await adminCount()).toBe(1);
  });

  it("a member of another wedding cannot be reached through this one", async () => {
    await db.collection("weddingMembers").deleteMany({ weddingId });
    const mine = await addMember(await addUser("mine"), "admin");
    const otherWedding = new ObjectId();
    const outsiderId = new ObjectId();
    await db.collection("weddingMembers").insertOne({
      _id: outsiderId,
      weddingId: otherWedding,
      userId: await addUser("outsider"),
      role: "manager",
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    try {
      const w = weddingId.toHexString();
      await expect(
        svc.removeMember({ weddingId: w, memberId: outsiderId.toHexString() }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        svc.changeMemberRole({ weddingId: w, memberId: outsiderId.toHexString(), role: "admin" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await db.collection("weddingMembers").findOne({ _id: outsiderId })).toMatchObject({
        role: "manager",
      });
      expect(mine).toBeTruthy();
    } finally {
      await db.collection("weddingMembers").deleteOne({ _id: outsiderId });
    }
  });

  it("an invitation can be used once: two simultaneous accepts, one wins", async () => {
    await db.collection("weddingMembers").deleteMany({ weddingId });
    const w = weddingId.toHexString();
    const inviteeId = await addUser("invitee");
    const result = await svc.inviteMember({
      weddingId: w,
      invitedByUserId: new ObjectId().toHexString(),
      inviterName: "Priya",
      weddingTitle: "Test",
      email: `${tag}-invitee@example.com`,
    });
    expect(result.renewed).toBe(false);

    // The link's token is only in the email; renew it to get a token we can hold.
    const { generateToken, hashToken } = await import("@/lib/tokens");
    const token = generateToken();
    await db
      .collection("memberInvites")
      .updateOne(
        { weddingId },
        { $set: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) } },
      );

    const results = await Promise.allSettled([
      svc.acceptInvite(inviteeId.toHexString(), token),
      svc.acceptInvite(inviteeId.toHexString(), token),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.collection("weddingMembers").countDocuments({ weddingId, userId: inviteeId }),
    ).toBe(1);
    expect(await db.collection("memberInvites").countDocuments({ weddingId })).toBe(0); // used up
    expect((await db.collection("weddingMembers").findOne({ userId: inviteeId }))?.role).toBe(
      "manager",
    );
  });

  it("signing up from an invitation creates a verified account and the membership together", async () => {
    await db.collection("weddingMembers").deleteMany({ weddingId });
    const w = weddingId.toHexString();
    const email = `${tag}-newbie@example.com`;
    await svc.inviteMember({
      weddingId: w,
      invitedByUserId: new ObjectId().toHexString(),
      inviterName: "Priya",
      weddingTitle: "Test",
      email,
    });
    const { generateToken, hashToken } = await import("@/lib/tokens");
    const token = generateToken();
    await db
      .collection("memberInvites")
      .updateOne(
        { weddingId, email },
        { $set: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) } },
      );

    const user = await svc.signUpWithInvite({
      name: "New Person",
      password: "a-long-enough-password",
      token,
    });
    userIds.push(new ObjectId(user.id));
    expect(user).toMatchObject({ email, emailVerified: true });
    expect(
      await db.collection("weddingMembers").findOne({ userId: new ObjectId(user.id) }),
    ).toMatchObject({ role: "manager" });
    expect(await db.collection("memberInvites").countDocuments({ weddingId, email })).toBe(0);
    // The same link cannot be used again.
    await expect(
      svc.signUpWithInvite({ name: "Again", password: "a-long-enough-password", token }),
    ).rejects.toMatchObject({ code: "LINK_INVALID" });
  });

  it("re-inviting the same address renews one invitation instead of adding a second", async () => {
    const w = weddingId.toHexString();
    const email = `${tag}-twice@example.com`;
    const base = {
      weddingId: w,
      invitedByUserId: new ObjectId().toHexString(),
      inviterName: "Priya",
      weddingTitle: "Test",
      email,
    };
    const first = await svc.inviteMember(base);
    const second = await svc.inviteMember(base);
    expect(second).toMatchObject({ renewed: true, inviteId: first.inviteId });
    expect(await db.collection("memberInvites").countDocuments({ weddingId, email })).toBe(1);
  });
});
