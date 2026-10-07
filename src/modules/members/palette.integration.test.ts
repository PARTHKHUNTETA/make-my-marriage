import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): each member's colour theme on the real database, with two
// throwaway weddings removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("colour themes against MongoDB", () => {
  let members: typeof import("./service");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const [uAdmin, uManager, uOther] = [new ObjectId(), new ObjectId(), new ObjectId()];
  const [mAdmin, mManager, mOther] = [new ObjectId(), new ObjectId(), new ObjectId()];
  const member = (
    _id: ObjectId,
    weddingId: ObjectId,
    userId: ObjectId,
    role: string,
    extra = {},
  ) => ({
    _id,
    weddingId,
    userId,
    role,
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  });
  const stored = async (id: ObjectId) =>
    (await db.collection("weddingMembers").findOne({ _id: id }))?.palette;
  const clean = async () =>
    db.collection("weddingMembers").deleteMany({ weddingId: { $in: [wA, wB] } });

  beforeAll(async () => {
    members = await import("./service");
    db = await (await import("@/lib/db")).getDb();
    await members.getMembership(new ObjectId().toHexString()); // creates the indexes
    await clean();
    await db
      .collection("weddingMembers")
      .insertMany([
        member(mAdmin, wA, uAdmin, "admin"),
        member(mManager, wA, uManager, "manager"),
        member(mOther, wB, uOther, "admin"),
      ]);
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("everyone starts on the default", async () => {
    for (const u of [uAdmin, uManager, uOther])
      expect((await members.getMembership(u.toHexString()))?.palette).toBe("aubergine");
  });

  it("saves a member's choice and reads it back with their context", async () => {
    await members.updatePalette(wA.toHexString(), mAdmin.toHexString(), "emerald");
    expect(await stored(mAdmin)).toBe("emerald");
    expect((await members.getMembership(uAdmin.toHexString()))?.palette).toBe("emerald");
  });

  it("two members of one wedding keep their own, and changing one never moves the other", async () => {
    await members.updatePalette(wA.toHexString(), mManager.toHexString(), "charcoal");
    expect((await members.getMembership(uAdmin.toHexString()))?.palette).toBe("emerald");
    expect((await members.getMembership(uManager.toHexString()))?.palette).toBe("charcoal");
    await members.updatePalette(wA.toHexString(), mAdmin.toHexString(), "fig");
    expect((await members.getMembership(uManager.toHexString()))?.palette).toBe("charcoal");
  });

  it("another wedding is untouched, and cannot be reached with the wrong wedding", async () => {
    expect((await members.getMembership(uOther.toHexString()))?.palette).toBe("aubergine");
    // Aiming at wedding B's member while signed in to wedding A finds nothing and changes nothing.
    await expect(
      members.updatePalette(wA.toHexString(), mOther.toHexString(), "indigo"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await stored(mOther)).toBeUndefined();
    await expect(
      members.updatePalette(wA.toHexString(), "not-an-id", "indigo"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("an unknown value in the database (old data) is read as the default, not an error", async () => {
    await db
      .collection("weddingMembers")
      .updateOne({ _id: mOther }, { $set: { palette: "hot-pink" } });
    expect((await members.getMembership(uOther.toHexString()))?.palette).toBe("aubergine");
  });

  it("choosing the same theme twice is harmless", async () => {
    await members.updatePalette(wA.toHexString(), mManager.toHexString(), "charcoal");
    await members.updatePalette(wA.toHexString(), mManager.toHexString(), "charcoal");
    expect(await stored(mManager)).toBe("charcoal");
  });
});
