import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): deletes and erases a throwaway wedding on the real database,
// beside a second one that must come through untouched.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!enabled)("deleting a wedding against MongoDB", () => {
  let svc: typeof import("./service");
  let wedding: typeof import("@/modules/wedding/service");
  let storage: typeof import("@/lib/storage");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();
  const photoA = new ObjectId();
  const photoB = new ObjectId();
  const TABLES = [
    "weddingMembers",
    "memberInvites",
    "events",
    "tasks",
    "guests",
    "checkIns",
    "seatingTables",
    "expenses",
    "budgets",
    "vendors",
    "albums",
    "photos",
    "notifications",
    "bookingRequests",
    "reviews",
    "emailQueue",
  ];
  const keyA = (name: string) => `weddings/${A}/photos/${photoA.toHexString()}/${name}`;
  const keyB = (name: string) => `weddings/${B}/photos/${photoB.toHexString()}/${name}`;

  // Some collections have unique indexes on fields that would otherwise all be empty.
  const unique = () => {
    const u = new ObjectId();
    return { zz: true, userId: u, email: `${u}@example.com`, tokenHash: `${u}`, token: `${u}` };
  };
  const weddingDoc = (_id: ObjectId, extra = {}) => ({
    _id,
    brideName: "Asha",
    groomName: "Dev",
    title: "Asha weds Dev",
    date: new Date("2099-02-14T00:00:00+05:30"),
    city: "Pune",
    website: {
      slug: `zz-del-${_id.toHexString()}`,
      theme: "minimal",
      isOn: true,
      showGallery: false,
      showLive: false,
    },
    galleryToken: `zzd${_id.toHexString()}`,
    uploadsOn: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  });

  beforeAll(async () => {
    svc = await import("./service");
    wedding = await import("@/modules/wedding/service");
    storage = await import("@/lib/storage");
    const { getDb } = await import("@/lib/db");
    db = await getDb();
    await wedding.getWedding(A); // creates the indexes
    await db.collection("weddings").insertMany([weddingDoc(wA), weddingDoc(wB)]);
    for (const [id, photo, key] of [
      [wA, photoA, keyA],
      [wB, photoB, keyB],
    ] as const) {
      for (const name of TABLES) {
        await db
          .collection(name)
          .insertOne(
            name === "photos"
              ? { weddingId: id, _id: photo, originalKey: key("original"), thumbKey: key("thumb") }
              : { weddingId: id, ...unique() },
          );
      }
      await storage.localWrite(key("original"), new Uint8Array([1, 2, 3]));
      await storage.localWrite(key("thumb"), new Uint8Array([4]));
    }
  });
  afterAll(async () => {
    if (!db) return;
    for (const name of [...TABLES, "weddings"]) {
      await db
        .collection(name)
        .deleteMany(
          name === "weddings" ? { _id: { $in: [wA, wB] } } : { weddingId: { $in: [wA, wB] } },
        );
    }
    await storage.deleteObjects([keyA("original"), keyA("thumb"), keyB("original"), keyB("thumb")]);
  });

  it("refuses when the title does not match, and changes nothing", async () => {
    await expect(svc.deleteWedding(A, "something else")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(await wedding.getWedding(A)).not.toBeNull();
    expect(await db.collection("weddingMembers").countDocuments({ weddingId: wA })).toBe(1);
  });

  it("hides the wedding at once and removes everyone's access, leaving the data for now", async () => {
    await svc.deleteWedding(A, "  ASHA   weds dev ");
    expect(await wedding.getWedding(A)).toBeNull();
    expect(await wedding.getWeddingBySlug(`zz-del-${A}`)).toBeNull();
    expect(await wedding.getGalleryByToken(`zzd${A}`)).toBeNull();
    await expect(wedding.getGallerySettings(A)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.collection("weddingMembers").countDocuments({ weddingId: wA })).toBe(0);
    expect(await db.collection("memberInvites").countDocuments({ weddingId: wA })).toBe(0);
    expect(await db.collection("guests").countDocuments({ weddingId: wA })).toBe(1);
    // the other wedding is untouched
    expect(await wedding.getWedding(B)).not.toBeNull();
    expect(await db.collection("weddingMembers").countDocuments({ weddingId: wB })).toBe(1);
    // and it cannot be deleted twice
    await expect(svc.deleteWedding(A, "Asha weds Dev")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("does not erase before the grace period, and never touches a live wedding", async () => {
    const now = new Date();
    await svc.purgeDeletedWeddings(now);
    expect(await db.collection("weddings").countDocuments({ _id: wA })).toBe(1);
    expect(await db.collection("weddings").countDocuments({ _id: wB })).toBe(1);
    // far in the future even the live one is not a candidate, since it was never deleted
    await svc.purgeDeletedWeddings(new Date(now.getTime() + 400 * DAY));
    expect(await db.collection("weddings").countDocuments({ _id: wB })).toBe(1);
  });

  it("erases every row and file of the deleted wedding, and only that wedding's", async () => {
    // (the previous step already ran the sweep a long way into the future)
    for (const name of [...TABLES, "weddings"]) {
      const filter = name === "weddings" ? { _id: wA } : { weddingId: wA };
      expect(await db.collection(name).countDocuments(filter), name).toBe(0);
    }
    for (const name of TABLES) {
      expect(await db.collection(name).countDocuments({ weddingId: wB }), name).toBe(1);
    }
    expect(await storage.localRead(keyA("original"))).toBeNull();
    expect(await storage.localRead(keyA("thumb"))).toBeNull();
    expect(await storage.localRead(keyB("original"))).not.toBeNull();
  });
});
