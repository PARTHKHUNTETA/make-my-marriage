import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): one account on several weddings, on the real database.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("one account on several weddings against MongoDB", () => {
  let svc: typeof import("./service");
  let db: Db;
  const tag = `zz-multi-${Date.now()}`;
  const wA = new ObjectId();
  const wB = new ObjectId();
  let userId = "";
  let ownerB = "";

  const weddingDoc = (_id: ObjectId, name: string) => ({
    _id,
    brideName: name,
    groomName: "Dev",
    title: `${name} weds Dev`,
    date: new Date("2099-02-14T00:00:00+05:30"),
    city: "Pune",
    website: {
      slug: `${tag}-${_id}`,
      theme: "minimal",
      isOn: false,
      showGallery: false,
      showLive: false,
    },
    galleryToken: `${tag}${_id}`,
    uploadsOn: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeAll(async () => {
    svc = await import("./service");
    db = await (await import("@/lib/db")).getDb();
    await svc.getMembership(new ObjectId().toHexString()); // creates the indexes
    await db.collection("weddings").insertMany([weddingDoc(wA, "Asha"), weddingDoc(wB, "Bina")]);
    userId = (
      await svc.signUp({
        name: "Multi User",
        email: `${tag}@example.com`,
        password: "a-long-enough-password-1",
      })
    ).id;
    ownerB = (
      await svc.signUp({
        name: "Owner B",
        email: `${tag}-b@example.com`,
        password: "a-long-enough-password-1",
      })
    ).id;
    await svc.addAdminMember({ userId, weddingId: wA.toHexString() });
    await svc.addAdminMember({ userId: ownerB, weddingId: wB.toHexString() });
  });

  afterAll(async () => {
    if (!db) return;
    const ids = [userId, ownerB].filter(Boolean).map((i) => new ObjectId(i));
    await db.collection("weddingMembers").deleteMany({ userId: { $in: ids } });
    await db.collection("memberInvites").deleteMany({ weddingId: { $in: [wA, wB] } });
    await db.collection("weddings").deleteMany({ _id: { $in: [wA, wB] } });
    await db.collection("users").deleteMany({ _id: { $in: ids } });
    await db.collection("emailQueue").deleteMany({ toEmail: new RegExp(`^${tag}`) });
  });

  it("the old one-wedding-per-account index is gone, and the pair is unique", async () => {
    const names = (await db.collection("weddingMembers").indexes()).map((i) => i.name);
    expect(names).not.toContain("userId_1");
    expect(names).toContain("userId_1_weddingId_1");
  });

  it("can be invited to a second wedding, accepts, and then belongs to both", async () => {
    await svc.inviteMember({
      weddingId: wB.toHexString(),
      invitedByUserId: ownerB,
      inviterName: "Owner B",
      weddingTitle: "Bina weds Dev",
      email: `${tag}@example.com`,
    });
    const mail = await db
      .collection("emailQueue")
      .findOne({ toEmail: `${tag}@example.com`, type: "member_invite" });
    const token = (mail!.payload as { url: string }).url.split("/").pop()!;
    await expect(svc.acceptInvite(userId, token)).resolves.toEqual({ weddingId: wB.toHexString() });

    const mine = await svc.listMyMemberships(userId);
    expect(mine.map((m) => [m.weddingId, m.role])).toEqual([
      [wA.toHexString(), "admin"],
      [wB.toHexString(), "manager"],
    ]);
    expect(mine[0]!.weddingIds).toEqual([wA.toHexString(), wB.toHexString()]);
  });

  it("works in the wedding last chosen, falling back to the first if it is gone or unknown", async () => {
    expect((await svc.getMembership(userId))?.weddingId).toBe(wA.toHexString());
    expect((await svc.getMembership(userId, wB.toHexString()))?.role).toBe("manager");
    expect((await svc.getMembership(userId, new ObjectId().toHexString()))?.weddingId).toBe(
      wA.toHexString(),
    );
    expect(await svc.belongsToWedding(userId, wB.toHexString())).toBe(true);
    expect(await svc.belongsToWedding(ownerB, wA.toHexString())).toBe(false);
  });

  it("will not invite someone already on the wedding, or add them twice", async () => {
    await expect(
      svc.inviteMember({
        weddingId: wB.toHexString(),
        invitedByUserId: ownerB,
        inviterName: "Owner B",
        weddingTitle: "Bina weds Dev",
        email: `${tag}@example.com`,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    await expect(svc.addAdminMember({ userId, weddingId: wB.toHexString() })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("leaving one wedding keeps the other", async () => {
    const mine = await svc.listMyMemberships(userId);
    await svc.removeMember({ weddingId: wB.toHexString(), memberId: mine[1]!.memberId });
    const left = await svc.listMyMemberships(userId);
    expect(left.map((m) => m.weddingId)).toEqual([wA.toHexString()]);
  });
});
