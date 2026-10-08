import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): wedding and event cover pictures on the real database and
// the development storage folder, with two throwaway weddings removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

const JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
]);
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

describe.skipIf(!enabled)("cover pictures against MongoDB", () => {
  let covers: typeof import("./covers");
  let wedding: typeof import("@/modules/wedding/service");
  let events: typeof import("@/modules/events/service");
  let storage: typeof import("@/lib/storage");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();
  const eventId = new ObjectId();
  const weddingDoc = (id: ObjectId) => ({
    _id: id,
    brideName: "Asha",
    groomName: "Dev",
    title: "Asha weds Dev",
    date: new Date("2099-02-14T00:00:00+05:30"),
    city: "Pune",
    website: {
      slug: `zz-cov-${id.toHexString()}`,
      theme: "minimal",
      isOn: false,
      showGallery: false,
      showLive: false,
    },
    galleryToken: `zzc${id.toHexString()}`,
    uploadsOn: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const upload = async (
    weddingId: string,
    target: import("./covers").CoverTarget,
    bytes = JPEG,
  ) => {
    const { coverId } = await covers.requestCoverUpload(weddingId, target, 100);
    await storage.localWrite(storage.coverKey(weddingId, coverId), bytes);
    return coverId;
  };
  const weddingCover = async () =>
    (await db.collection("weddings").findOne({ _id: wA }))?.coverImageKey as string | undefined;
  const eventCover = async () =>
    (await db.collection("events").findOne({ _id: eventId }))?.coverImageKey as string | undefined;
  const clean = async () => {
    for (const id of [A, B]) {
      for (const c of await db
        .collection("weddings")
        .find({ _id: new ObjectId(id) })
        .toArray())
        if (c.coverImageKey) await storage.deleteObjects([c.coverImageKey]);
    }
    await db.collection("weddings").deleteMany({ _id: { $in: [wA, wB] } });
    await db.collection("events").deleteMany({ weddingId: { $in: [wA, wB] } });
  };

  beforeAll(async () => {
    covers = await import("./covers");
    wedding = await import("@/modules/wedding/service");
    events = await import("@/modules/events/service");
    storage = await import("@/lib/storage");
    db = await (await import("@/lib/db")).getDb();
    await wedding.getWedding(new ObjectId().toHexString());
    await events.listEvents(A);
    await clean();
    await db.collection("weddings").insertMany([weddingDoc(wA), weddingDoc(wB)]);
    await db.collection("events").insertOne({
      _id: eventId,
      weddingId: wA,
      type: "custom",
      name: "Haldi",
      date: new Date("2099-02-13T00:00:00+05:30"),
      startTime: "10:00",
      showOnWebsite: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("a wedding cover goes live on confirm, and a new one replaces and deletes the old", async () => {
    const first = await upload(A, { kind: "wedding" });
    expect(await weddingCover()).toBeUndefined();
    await covers.confirmCover(A, { kind: "wedding" }, first);
    const firstKey = storage.coverKey(A, first);
    expect(await weddingCover()).toBe(firstKey);
    expect((await wedding.getWedding(A))?.coverImageKey).toBe(firstKey);

    const second = await upload(A, { kind: "wedding" });
    await covers.confirmCover(A, { kind: "wedding" }, second);
    expect(await weddingCover()).toBe(storage.coverKey(A, second));
    expect(await storage.objectSize(firstKey)).toBeNull();
    expect(await storage.objectSize(storage.coverKey(A, second))).toBe(JPEG.length);
  });

  it("confirming the same upload twice is harmless and keeps the file", async () => {
    const id = await upload(A, { kind: "wedding" });
    await covers.confirmCover(A, { kind: "wedding" }, id);
    await covers.confirmCover(A, { kind: "wedding" }, id);
    expect(await weddingCover()).toBe(storage.coverKey(A, id));
    expect(await storage.objectSize(storage.coverKey(A, id))).toBe(JPEG.length);
  });

  it("refuses a file that is not a JPEG, removes it, and keeps the current cover", async () => {
    const current = await weddingCover();
    const bad = await upload(A, { kind: "wedding" }, HTML);
    await expect(covers.confirmCover(A, { kind: "wedding" }, bad)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(await storage.objectSize(storage.coverKey(A, bad))).toBeNull();
    expect(await weddingCover()).toBe(current);
  });

  it("refuses a picture that never arrived, and one uploaded for another wedding", async () => {
    const { coverId } = await covers.requestCoverUpload(A, { kind: "wedding" }, 100);
    await expect(covers.confirmCover(A, { kind: "wedding" }, coverId)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    const theirs = await upload(B, { kind: "wedding" });
    await expect(covers.confirmCover(A, { kind: "wedding" }, theirs)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(await storage.objectSize(storage.coverKey(B, theirs))).toBe(JPEG.length);
  });

  it("an event cover is set, replaced and removed, and only for the wedding's own events", async () => {
    const target = { kind: "event", eventId: eventId.toHexString() } as const;
    const a = await upload(A, target);
    await covers.confirmCover(A, target, a);
    expect(await eventCover()).toBe(storage.coverKey(A, a));
    expect((await events.getEvent(A, eventId.toHexString()))?.coverImageKey).toBe(
      storage.coverKey(A, a),
    );

    await expect(covers.requestCoverUpload(B, target, 100)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(covers.removeCover(B, target)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await eventCover()).toBe(storage.coverKey(A, a));

    await covers.removeCover(A, target);
    expect(await eventCover()).toBeUndefined();
    expect(await storage.objectSize(storage.coverKey(A, a))).toBeNull();
  });

  it("deleting an event deletes its cover picture too", async () => {
    const doomed = new ObjectId();
    await db.collection("events").insertOne({
      _id: doomed,
      weddingId: wA,
      type: "custom",
      name: "Doomed",
      date: new Date("2099-02-15T00:00:00+05:30"),
      startTime: "10:00",
      showOnWebsite: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const target = { kind: "event", eventId: doomed.toHexString() } as const;
    const id = await upload(A, target);
    await covers.confirmCover(A, target, id);
    expect(await storage.objectSize(storage.coverKey(A, id))).toBe(JPEG.length);
    await events.deleteEvent(A, doomed.toHexString());
    expect(await storage.objectSize(storage.coverKey(A, id))).toBeNull();
  });

  it("removing the wedding cover clears it and deletes the file", async () => {
    const key = await weddingCover();
    expect(key).toBeTruthy();
    await covers.removeCover(A, { kind: "wedding" });
    expect(await weddingCover()).toBeUndefined();
    expect(await storage.objectSize(key!)).toBeNull();
    await covers.removeCover(A, { kind: "wedding" }); // nothing to remove: still fine
  });

  it("a cover address shows the stored file", async () => {
    expect(await covers.coverUrl(undefined)).toBeUndefined();
    const id = await upload(A, { kind: "wedding" });
    await covers.confirmCover(A, { kind: "wedding" }, id);
    expect(await covers.coverUrl(storage.coverKey(A, id))).toContain(`/covers/${id}`);
  });
});
