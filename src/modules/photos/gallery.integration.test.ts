import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): the guest gallery link, guest uploads, moderation and the
// 60-day sweep on the real database, with two throwaway weddings removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

const JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
]);

const thumbUrl = (items: { thumbUrl?: string }[]) => items[0]?.thumbUrl;

describe.skipIf(!enabled)("the guest gallery against MongoDB", () => {
  let gallery: typeof import("./gallery");
  let photos: typeof import("./service");
  let repo: typeof import("./repository");
  let wedding: typeof import("@/modules/wedding/service");
  let storage: typeof import("@/lib/storage");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();
  const tokenA = `zzA${A}`;
  const me = new ObjectId().toHexString();
  let n = 0;
  const key = () => `gk-${Date.now()}-${n++}-abcdefgh`;
  const file = () => ({
    clientKey: key(),
    name: "IMG.jpg",
    type: "image/jpeg" as const,
    size: JPEG.length,
    hasDisplay: false,
    hasThumb: false,
  });
  const weddingDoc = (id: ObjectId, token: string, uploadsOn: boolean) => ({
    _id: id,
    brideName: "Asha",
    groomName: "Dev",
    title: "Asha weds Dev",
    date: new Date("2099-02-14T00:00:00+05:30"),
    city: "Pune",
    website: {
      slug: `zz-gal-${id.toHexString()}`,
      theme: "minimal",
      isOn: false,
      showGallery: false,
      showLive: false,
    },
    galleryToken: token,
    uploadsOn,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const general = async (w: string) =>
    (await photos.listAlbums(w, [])).find((a) => a.isGeneral)!.id;
  // A guest upload that has arrived, confirmed and waiting.
  const guestPhoto = async (w: string, token: string, name?: string) => {
    const access = await gallery.openGallery(token);
    const album = await general(w);
    const [slot] = await gallery.guestRequestUploads(access, {
      albumId: album,
      files: [file()],
      name,
    });
    const doc = await repo.findPhoto(w, slot!.photoId);
    await storage.localWrite(doc!.originalKey, JPEG);
    const [res] = await gallery.guestConfirmUploads(access, [slot!.photoId]);
    expect(res).toMatchObject({ ok: true });
    return slot!.photoId;
  };
  const clean = async () => {
    const ids = [wA, wB];
    const docs = await db
      .collection("photos")
      .find({ weddingId: { $in: ids } })
      .toArray();
    await storage.deleteObjects(
      docs.flatMap((d) => [d.originalKey, d.displayKey, d.thumbKey].filter(Boolean)),
    );
    for (const c of ["photos", "albums"])
      await db.collection(c).deleteMany({ weddingId: { $in: ids } });
    await db.collection("weddings").deleteMany({ _id: { $in: ids } });
  };

  beforeAll(async () => {
    gallery = await import("./gallery");
    photos = await import("./service");
    repo = await import("./repository");
    wedding = await import("@/modules/wedding/service");
    storage = await import("@/lib/storage");
    db = await (await import("@/lib/db")).getDb();
    await wedding.getWedding(new ObjectId().toHexString());
    await photos.listAlbums(A, []);
    await clean();
    await db
      .collection("weddings")
      .insertMany([weddingDoc(wA, tokenA, true), weddingDoc(wB, `zzB${B}`, true)]);
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("a link opens exactly its own wedding, and nothing else does", async () => {
    expect(await gallery.openGallery(tokenA)).toMatchObject({ weddingId: A, uploadsOn: true });
    await expect(gallery.openGallery("not-a-real-token-0000")).rejects.toMatchObject({
      code: "LINK_INVALID",
    });
    await expect(gallery.openGallery(A)).rejects.toMatchObject({ code: "LINK_INVALID" }); // an id is not a link
  });

  it("a guest's photo waits for approval: invisible and not downloadable until then", async () => {
    const id = await guestPhoto(A, tokenA, "Meera");
    const access = await gallery.openGallery(tokenA);
    expect((await gallery.guestPhotos(access, undefined, 1)).items.map((p) => p.id)).not.toContain(
      id,
    );
    await expect(gallery.guestDownloadUrl(access, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await repo.findPhoto(A, id))?.status).toBe("pending");

    expect(await photos.approve(A, [id])).toBe(1);
    const shown = await gallery.guestPhotos(access, undefined, 1);
    expect(shown.items.map((p) => p.id)).toContain(id);
    expect(await gallery.guestDownloadUrl(access, id)).toContain("/api/dev-storage/");
  });

  it("what a guest sees of a photo carries no names, ids or wedding details", async () => {
    const id = await guestPhoto(A, tokenA, "Secret Name");
    await photos.approve(A, [id]);
    const access = await gallery.openGallery(tokenA);
    const shown = await gallery.guestPhotos(access, undefined, 1);
    // The image addresses carry the storage path (and so the wedding id), which grants nothing; every
    // other field must be free of it.
    const json = JSON.stringify(
      shown.items.map((p) =>
        Object.fromEntries(Object.entries(p).filter(([k]) => !k.endsWith("Url"))),
      ),
    );
    expect(thumbUrl(shown.items)).toBeTruthy();
    expect(json).not.toContain("Secret Name");
    expect(json).not.toContain(A);
    expect(json).not.toContain("uploader");
    expect(json).not.toContain("weddingId");
  });

  it("with uploads off, guests can still look but cannot add", async () => {
    await wedding.setUploadsOn(A, false);
    const access = await gallery.openGallery(tokenA);
    expect(access.uploadsOn).toBe(false);
    await expect(
      gallery.guestRequestUploads(access, { albumId: await general(A), files: [file()] }),
    ).rejects.toMatchObject({ code: "UPLOADS_CLOSED" });
    await expect(
      gallery.guestConfirmUploads(access, [new ObjectId().toHexString()]),
    ).rejects.toMatchObject({
      code: "UPLOADS_CLOSED",
    });
    await expect(gallery.guestPhotos(access, undefined, 1)).resolves.toBeTruthy();
    await wedding.setUploadsOn(A, true);
  });

  it("a guest cannot upload to another wedding's album or confirm another wedding's photo", async () => {
    const access = await gallery.openGallery(tokenA);
    const theirs = await general(B);
    await expect(
      gallery.guestRequestUploads(access, { albumId: theirs, files: [file()] }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const idB = await guestPhoto(B, `zzB${B}`);
    const [res] = await gallery.guestConfirmUploads(access, [idB]);
    expect(res).toMatchObject({ ok: false });
    expect(await repo.findPhoto(A, idB)).toBeNull();
  });

  it("members and guests each confirm only their own uploads", async () => {
    const album = await general(A);
    const access = await gallery.openGallery(tokenA);
    const [mine] = await photos.requestUploads(
      A,
      { albumId: album, files: [file()] },
      { type: "member", memberId: me },
    );
    await storage.localWrite((await repo.findPhoto(A, mine!.photoId))!.originalKey, JPEG);
    expect((await gallery.guestConfirmUploads(access, [mine!.photoId]))[0]).toMatchObject({
      ok: false,
    });
    expect((await repo.findPhoto(A, mine!.photoId))?.status).toBe("uploading");
    expect((await photos.confirmUploads(A, [mine!.photoId], "member"))[0]).toMatchObject({
      ok: true,
    });
    expect((await repo.findPhoto(A, mine!.photoId))?.status).toBe("approved");

    const [theirs] = await gallery.guestRequestUploads(access, { albumId: album, files: [file()] });
    await storage.localWrite((await repo.findPhoto(A, theirs!.photoId))!.originalKey, JPEG);
    expect((await photos.confirmUploads(A, [theirs!.photoId], "member"))[0]).toMatchObject({
      ok: false,
    });
    expect((await repo.findPhoto(A, theirs!.photoId))?.status).toBe("uploading");
  });

  it("the review list groups waiting photos by who added them", async () => {
    await guestPhoto(A, tokenA, "Zoya");
    await guestPhoto(A, tokenA, "Zoya");
    await guestPhoto(A, tokenA);
    const { groups } = await photos.listPendingGroups(A);
    const zoya = groups.find((g) => g.uploader === "Zoya");
    expect(zoya?.items.length).toBeGreaterThanOrEqual(2);
    expect(groups.find((g) => g.uploader === null)?.label).toBe("Guests who gave no name");
  });

  it("approve-all-from approves one person's photos only", async () => {
    const mine = await guestPhoto(A, tokenA, "Kabir");
    const other = await guestPhoto(A, tokenA, "Rhea");
    const anon = await guestPhoto(A, tokenA);
    expect(await photos.approveAllFrom(A, "Kabir")).toBeGreaterThanOrEqual(1);
    expect((await repo.findPhoto(A, mine))?.status).toBe("approved");
    expect((await repo.findPhoto(A, other))?.status).toBe("pending");
    expect((await repo.findPhoto(A, anon))?.status).toBe("pending");
    await photos.approveAllFrom(A, null);
    expect((await repo.findPhoto(A, anon))?.status).toBe("approved");
    expect((await repo.findPhoto(A, other))?.status).toBe("pending");
  });

  it("rejecting deletes the photo and its files, and cannot delete an approved photo", async () => {
    const waiting = await guestPhoto(A, tokenA, "Nope");
    const live = await guestPhoto(A, tokenA, "Fine");
    await photos.approve(A, [live]);
    const waitingDoc = await repo.findPhoto(A, waiting);
    expect(await photos.reject(A, [waiting, live])).toBe(1);
    expect(await repo.findPhoto(A, waiting)).toBeNull();
    expect(await storage.objectSize(waitingDoc!.originalKey)).toBeNull();
    expect((await repo.findPhoto(A, live))?.status).toBe("approved");
  });

  it("waiting photos count toward the storage quota", async () => {
    const before = (await photos.getUsage(A)).usedBytes;
    await guestPhoto(A, tokenA, "Quota");
    expect((await photos.getUsage(A)).usedBytes).toBe(before + JPEG.length);
  });

  it("another wedding's review actions never touch these photos", async () => {
    const id = await guestPhoto(A, tokenA, "Mine");
    expect(await photos.approve(B, [id])).toBe(0);
    expect(await photos.reject(B, [id])).toBe(0);
    expect(await photos.approveAllFrom(B, "Mine")).toBe(0);
    expect((await repo.findPhoto(A, id))?.status).toBe("pending");
  });

  it("the sweep deletes waiting photos older than 60 days, and only those", async () => {
    const old = await guestPhoto(A, tokenA, "Old");
    const fresh = await guestPhoto(A, tokenA, "Fresh");
    const oldApproved = await guestPhoto(A, tokenA, "OldApproved");
    await photos.approve(A, [oldApproved]);
    const longAgo = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000);
    await db
      .collection("photos")
      .updateMany(
        { _id: { $in: [old, oldApproved].map((i) => new ObjectId(i)) } },
        { $set: { uploadedAt: longAgo } },
      );
    const oldDoc = await repo.findPhoto(A, old);
    const result = await photos.purgeStalePending();
    expect(result.deleted).toBeGreaterThanOrEqual(1);
    expect(await repo.findPhoto(A, old)).toBeNull();
    expect(await storage.objectSize(oldDoc!.originalKey)).toBeNull();
    expect(await repo.findPhoto(A, fresh)).not.toBeNull();
    expect(await repo.findPhoto(A, oldApproved)).not.toBeNull();
    const { expiring } = await photos.listPendingGroups(A);
    expect(expiring).toBe(0);
  });

  it("resetting the link kills the old one at once and the new one works", async () => {
    const fresh = await wedding.resetGalleryToken(A);
    await expect(gallery.openGallery(tokenA)).rejects.toMatchObject({ code: "LINK_INVALID" });
    expect(await gallery.openGallery(fresh)).toMatchObject({ weddingId: A });
    expect(fresh).toMatch(/^[0-9A-Za-z]{22}$/);
    expect((await wedding.getGallerySettings(A)).token).toBe(fresh);
  });
});
