import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): albums, the upload handshake, quota and deletion on the real
// database, with files going to the development storage folder.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

let quota = 10 * 1024 * 1024 * 1024;
vi.mock("@/lib/env", async (original) => ({
  ...(await original<typeof import("@/lib/env")>()),
  photoQuotaBytes: () => quota,
}));

const JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
]);
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

describe.skipIf(!enabled)("photos against MongoDB", () => {
  let photos: typeof import("./service");
  let repo: typeof import("./repository");
  let storage: typeof import("@/lib/storage");
  let db: Db;
  const w1 = new ObjectId().toHexString();
  const w2 = new ObjectId().toHexString();
  const me = new ObjectId().toHexString();
  const ev1 = new ObjectId().toHexString();
  let n = 0;
  const key = () => `key-${Date.now()}-${n++}-abcdefgh`;
  const file = (over: Record<string, unknown> = {}) => ({
    clientKey: key(),
    name: "IMG_1.jpg",
    type: "image/jpeg" as const,
    size: JPEG.length,
    hasDisplay: false,
    hasThumb: false,
    ...over,
  });
  const upload = async (weddingId: string, albumId: string, f = file(), bytes = JPEG) => {
    const [slot] = await photos.requestUploads(
      weddingId,
      { albumId, files: [f] },
      { type: "member", memberId: me },
    );
    expect(slot?.state).toBe("upload");
    // The slot carries the device's own key, so the browser can match it to its file.
    expect(slot?.clientKey).toBe(f.clientKey);
    const doc = await repo.findPhoto(weddingId, slot!.photoId);
    await storage.localWrite(doc!.originalKey, bytes);
    return slot!;
  };
  const general = async (weddingId: string) =>
    (await photos.listAlbums(weddingId, [])).find((a) => a.isGeneral)!.id;
  const clean = async () => {
    const docs = await db
      .collection("photos")
      .find({ weddingId: { $in: [new ObjectId(w1), new ObjectId(w2)] } })
      .toArray();
    await storage.deleteObjects(
      docs.flatMap((d) => [d.originalKey, d.displayKey, d.thumbKey].filter(Boolean)),
    );
    for (const col of ["photos", "albums"])
      await db
        .collection(col)
        .deleteMany({ weddingId: { $in: [new ObjectId(w1), new ObjectId(w2)] } });
  };

  beforeAll(async () => {
    photos = await import("./service");
    repo = await import("./repository");
    storage = await import("@/lib/storage");
    db = await (await import("@/lib/db")).getDb();
    await photos.listAlbums(w1, []);
    await clean();
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("creates the General album and one per event, once, and follows event renames", async () => {
    const first = await photos.listAlbums(w1, [{ id: ev1, name: "Haldi" }]);
    expect(first.map((a) => a.name)).toEqual(["General", "Haldi"]);
    const again = await Promise.all([
      photos.listAlbums(w1, [{ id: ev1, name: "Haldi ceremony" }]),
      photos.listAlbums(w1, [{ id: ev1, name: "Haldi ceremony" }]),
    ]);
    expect(again[0]!.map((a) => a.name)).toEqual(["General", "Haldi ceremony"]);
    expect(await db.collection("albums").countDocuments({ weddingId: new ObjectId(w1) })).toBe(2);
  });

  it("a real photo goes through sign, upload and confirm, and then shows in its album", async () => {
    const album = await general(w1);
    const slot = await upload(w1, album);
    expect((await photos.listPhotos(w1, { albumId: album, status: "approved" }, 1)).total).toBe(0);
    expect(await photos.confirmUploads(w1, [slot.photoId], "member")).toEqual([
      { photoId: slot.photoId, ok: true },
    ]);
    const list = await photos.listPhotos(w1, { albumId: album, status: "approved" }, 1);
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({
      fileName: "IMG_1.jpg",
      uploaderType: "member",
      viewable: true,
    });
    expect(list.items[0]!.thumbUrl).toContain("/api/dev-storage/weddings/");
  });

  it("sending the same file twice makes one photo, before and after it is confirmed", async () => {
    const album = await general(w1);
    const f = file();
    const input = { albumId: album, files: [f] };
    const [a, b] = await Promise.all([
      photos.requestUploads(w1, input, { type: "member", memberId: me }),
      photos.requestUploads(w1, input, { type: "member", memberId: me }),
    ]);
    expect(a![0]!.photoId).toBe(b![0]!.photoId);
    const doc = await repo.findPhoto(w1, a![0]!.photoId);
    await storage.localWrite(doc!.originalKey, JPEG);
    await photos.confirmUploads(w1, [a![0]!.photoId], "member");
    await photos.confirmUploads(w1, [a![0]!.photoId], "member"); // harmless
    const [again] = await photos.requestUploads(w1, input, { type: "member", memberId: me });
    expect(again).toMatchObject({ photoId: a![0]!.photoId, state: "done" });
    expect(
      await db
        .collection("photos")
        .countDocuments({ weddingId: new ObjectId(w1), uploadKey: `u:${f.clientKey}` }),
    ).toBe(1);
  });

  it("refuses a file that is not really an image, and removes it", async () => {
    const album = await general(w1);
    const slot = await upload(w1, album, file({ name: "holiday.jpg" }), HTML);
    const [result] = await photos.confirmUploads(w1, [slot.photoId], "member");
    expect(result).toMatchObject({ ok: false });
    expect(await repo.findPhoto(w1, slot.photoId)).toBeNull();
    expect(
      await storage.objectSize(
        (await repo.findPhoto(w1, slot.photoId))?.originalKey ??
          `weddings/${w1}/photos/${slot.photoId}/original`,
      ),
    ).toBeNull();
  });

  it("a photo that never arrived is reported, not saved", async () => {
    const album = await general(w1);
    const [slot] = await photos.requestUploads(
      w1,
      { albumId: album, files: [file()] },
      { type: "member", memberId: me },
    );
    const [result] = await photos.confirmUploads(w1, [slot!.photoId], "member");
    expect(result!.ok).toBe(false);
    expect((await repo.findPhoto(w1, slot!.photoId))?.status).toBe("uploading");
  });

  it("a claimed JPEG that is not one is refused", async () => {
    const album = await general(w1);
    const slot = await upload(w1, album, file({ type: "image/png" }), JPEG);
    expect((await photos.confirmUploads(w1, [slot.photoId], "member"))[0]!.ok).toBe(false);
  });

  it("made copies are kept only when they arrive and really are JPEGs", async () => {
    const album = await general(w1);
    const slot = await upload(w1, album, file({ hasDisplay: true, hasThumb: true }));
    const doc = await repo.findPhoto(w1, slot.photoId);
    await storage.localWrite(doc!.displayKey!, JPEG);
    await storage.localWrite(doc!.thumbKey!, HTML);
    await photos.confirmUploads(w1, [slot.photoId], "member");
    const after = await repo.findPhoto(w1, slot.photoId);
    expect(after?.displayKey).toBeTruthy();
    expect(after?.thumbKey).toBeUndefined();
    expect(after?.sizeBytes).toBe(JPEG.length * 2);
  });

  it("refuses a batch that would overfill the wedding's storage, counting what is on its way", async () => {
    const used = (await photos.getUsage(w2)).usedBytes;
    quota = used + 100;
    const album = await general(w2);
    await photos.requestUploads(
      w2,
      { albumId: album, files: [file({ size: 60 })] },
      { type: "member", memberId: me },
    );
    await expect(
      photos.requestUploads(
        w2,
        { albumId: album, files: [file({ size: 60 })] },
        { type: "member", memberId: me },
      ),
    ).rejects.toMatchObject({ code: "STORAGE_FULL" });
    quota = 10 * 1024 ** 3;
  });

  it("one wedding can never see, move or delete another's photos", async () => {
    const mine = await general(w1);
    const slot = await upload(w1, mine);
    await photos.confirmUploads(w1, [slot.photoId], "member");
    const theirs = await general(w2);
    expect(await photos.deletePhotos(w2, [slot.photoId])).toBe(0);
    expect(await photos.moveToAlbum(w2, [slot.photoId], theirs)).toBe(0);
    await expect(photos.getDownload(w2, slot.photoId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(photos.moveToAlbum(w1, [slot.photoId], theirs)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await repo.findPhoto(w1, slot.photoId))?.albumId.toHexString()).toBe(mine);
  });

  it("deleting removes the records and the files, and can be repeated", async () => {
    const album = await general(w1);
    const slot = await upload(w1, album);
    await photos.confirmUploads(w1, [slot.photoId], "member");
    const doc = await repo.findPhoto(w1, slot.photoId);
    expect(await storage.objectSize(doc!.originalKey)).toBe(JPEG.length);
    expect(await photos.deletePhotos(w1, [slot.photoId])).toBe(1);
    expect(await storage.objectSize(doc!.originalKey)).toBeNull();
    expect(await photos.deletePhotos(w1, [slot.photoId])).toBe(0);
  });

  it("a download is a save-as address for the original under a safe name", async () => {
    const album = await general(w1);
    const slot = await upload(w1, album, file({ name: "../../Haldi 1.jpeg" }));
    await photos.confirmUploads(w1, [slot.photoId], "member");
    const dl = await photos.getDownload(w1, slot.photoId);
    expect(dl.fileName).toBe("Haldi 1.jpg");
    expect(dl.url).toContain("d=Haldi+1.jpg");
  });

  it("deleting an event's album moves its photos to General", async () => {
    const albums = await photos.listAlbums(w1, [{ id: ev1, name: "Haldi" }]);
    const haldi = albums.find((a) => a.eventId === ev1)!;
    const slot = await upload(w1, haldi.id);
    await photos.confirmUploads(w1, [slot.photoId], "member");
    const { inTransaction } = await import("@/lib/db");
    await inTransaction((session) => photos.removeEventAlbum(w1, ev1, { session }));
    const after = await photos.listAlbums(w1, []);
    expect(after.some((a) => a.eventId === ev1)).toBe(false);
    expect((await repo.findPhoto(w1, slot.photoId))?.albumId.toHexString()).toBe(
      after.find((a) => a.isGeneral)!.id,
    );
  });
});
