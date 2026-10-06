import { type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): vendor listing photos on the real database and the
// development storage folder, with throwaway vendors removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn().mockResolvedValue(true) }));

const JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
]);
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

describe.skipIf(!enabled)("listing photos against MongoDB", () => {
  let mkt: typeof import("./service");
  let photos: typeof import("./photos");
  let schema: typeof import("./schema");
  let storage: typeof import("@/lib/storage");
  let db: Db;
  const tag = `zz-lp-${Date.now()}`;

  const vendor = async (label: string, saveListing = true) => {
    const profile = await mkt.signUpVendor(
      schema.vendorSignupSchema.parse({
        businessName: `${tag} ${label}`,
        email: `${tag}-${label}@example.com`,
        phone: "98765 43210",
        password: "a-long-enough-pass",
      }),
    );
    const listing = saveListing
      ? await mkt.saveMyListing(
          profile.id,
          schema.listingInputSchema.parse({
            category: "dj",
            cities: "Pune",
            description: `About ${label}`,
          }),
        )
      : null;
    if (listing) await mkt.decideListing(listing.id, "approve");
    return { accountId: profile.id, listingId: listing?.id };
  };
  const add = async (accountId: string, bytes = JPEG) => {
    const [slot] = await photos.requestListingPhotoSlots(accountId, 1);
    const listing = await mkt.getMyListing(accountId);
    await storage.localWrite(storage.listingPhotoKey(listing!.id, slot!.photoId), bytes);
    await photos.confirmListingPhoto(accountId, slot!.photoId);
    return slot!.photoId;
  };
  const keys = async (accountId: string) => (await mkt.getMyListing(accountId))!.photoKeys;
  const status = async (accountId: string) => (await mkt.getMyListing(accountId))!.status;
  const clean = async () => {
    const accounts = (
      await db
        .collection("vendorAccounts")
        .find({ email: new RegExp(`^${tag}`) })
        .toArray()
    ).map((a) => a._id);
    const listings = await db
      .collection("listings")
      .find({ vendorAccountId: { $in: accounts } })
      .toArray();
    await storage.deleteObjects(
      listings.flatMap((l) => (l.photoKeys as string[] | undefined) ?? []),
    );
    await db.collection("listings").deleteMany({ _id: { $in: listings.map((l) => l._id) } });
    await db.collection("vendorAccounts").deleteMany({ _id: { $in: accounts } });
  };

  beforeAll(async () => {
    mkt = await import("./service");
    photos = await import("./photos");
    schema = await import("./schema");
    storage = await import("@/lib/storage");
    db = await (await import("@/lib/db")).getDb();
    await mkt.getMyListing("0".repeat(24));
    await mkt.getVendorAuthState("0".repeat(24));
    await clean();
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("a photo is added after upload, goes last, and sends a live listing back for review", async () => {
    const v = await vendor("add");
    expect(await status(v.accountId)).toBe("approved");
    const a = await add(v.accountId);
    const b = await add(v.accountId);
    expect((await keys(v.accountId)).map((k) => k.split("/").pop())).toEqual([a, b]);
    expect(await status(v.accountId)).toBe("pending");
    expect((await photos.listingPhotoUrls(await keys(v.accountId)))[0]!.url).toContain(
      "/api/dev-storage/listings/",
    );
  });

  it("saving the listing form keeps its photos", async () => {
    const v = await vendor("keep");
    await add(v.accountId);
    await mkt.saveMyListing(
      v.accountId,
      schema.listingInputSchema.parse({ category: "dj", cities: "Pune", description: "New words" }),
    );
    expect(await keys(v.accountId)).toHaveLength(1);
  });

  it("needs a saved listing first", async () => {
    const v = await vendor("nolisting", false);
    await expect(photos.requestListingPhotoSlots(v.accountId, 1)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("confirming twice adds one photo", async () => {
    const v = await vendor("twice");
    const id = await add(v.accountId);
    await photos.confirmListingPhoto(v.accountId, id);
    await Promise.all([
      photos.confirmListingPhoto(v.accountId, id),
      photos.confirmListingPhoto(v.accountId, id),
    ]);
    expect(await keys(v.accountId)).toHaveLength(1);
  });

  it("refuses a file that is not a JPEG, or that never arrived, and leaves nothing behind", async () => {
    const v = await vendor("bad");
    const [slot] = await photos.requestListingPhotoSlots(v.accountId, 1);
    const listing = await mkt.getMyListing(v.accountId);
    const key = storage.listingPhotoKey(listing!.id, slot!.photoId);
    await expect(photos.confirmListingPhoto(v.accountId, slot!.photoId)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await storage.localWrite(key, HTML);
    await expect(photos.confirmListingPhoto(v.accountId, slot!.photoId)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(await storage.objectSize(key)).toBeNull();
    expect(await keys(v.accountId)).toEqual([]);
  });

  it("stops at 20 photos, even when many confirmations race", async () => {
    const v = await vendor("cap");
    const ids: string[] = [];
    const listing = await mkt.getMyListing(v.accountId);
    for (let i = 0; i < 20; i += 5) {
      const slots = await photos.requestListingPhotoSlots(v.accountId, 5);
      for (const s of slots)
        await storage.localWrite(storage.listingPhotoKey(listing!.id, s.photoId), JPEG);
      await Promise.all(slots.map((s) => photos.confirmListingPhoto(v.accountId, s.photoId)));
      ids.push(...slots.map((s) => s.photoId));
    }
    expect(await keys(v.accountId)).toHaveLength(20);
    await expect(photos.requestListingPhotoSlots(v.accountId, 1)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    // A late 21st that slipped past the slot check is refused at confirm and its file removed.
    const extra = "a".repeat(24);
    const extraKey = storage.listingPhotoKey(listing!.id, extra);
    await storage.localWrite(extraKey, JPEG);
    await expect(photos.confirmListingPhoto(v.accountId, extra)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(await storage.objectSize(extraKey)).toBeNull();
    expect(await keys(v.accountId)).toHaveLength(20);
  });

  it("slots are trimmed to the room left", async () => {
    const v = await vendor("room");
    await add(v.accountId);
    expect(await photos.requestListingPhotoSlots(v.accountId, 20)).toHaveLength(19);
  });

  it("removing deletes the file, can be repeated, and does not send a live listing back for review", async () => {
    const v = await vendor("remove");
    const id = await add(v.accountId);
    await mkt.decideListing((await mkt.getMyListing(v.accountId))!.id, "approve");
    const key = (await keys(v.accountId))[0]!;
    await photos.removeListingPhoto(v.accountId, id);
    expect(await keys(v.accountId)).toEqual([]);
    expect(await storage.objectSize(key)).toBeNull();
    expect(await status(v.accountId)).toBe("approved");
    await photos.removeListingPhoto(v.accountId, id);
  });

  it("makes a chosen photo the cover, keeping the order of the rest", async () => {
    const v = await vendor("first");
    const [a, b, c] = [await add(v.accountId), await add(v.accountId), await add(v.accountId)];
    await photos.makeListingPhotoFirst(v.accountId, c);
    expect((await keys(v.accountId)).map((k) => k.split("/").pop())).toEqual([c, a, b]);
    await expect(photos.makeListingPhotoFirst(v.accountId, "b".repeat(24))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("a vendor can only touch their own listing's photos", async () => {
    const mine = await vendor("mine");
    const theirs = await vendor("theirs");
    const id = await add(theirs.accountId);
    await photos.removeListingPhoto(mine.accountId, id); // not on my listing: nothing happens
    expect(await keys(theirs.accountId)).toHaveLength(1);
    await expect(photos.makeListingPhotoFirst(mine.accountId, id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(photos.confirmListingPhoto(mine.accountId, id)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(await keys(mine.accountId)).toEqual([]);
  });

  it("a suspended listing stays suspended when its vendor adds a photo", async () => {
    const v = await vendor("susp");
    await mkt.decideListing((await mkt.getMyListing(v.accountId))!.id, "suspend", "Complaint");
    await add(v.accountId);
    expect(await status(v.accountId)).toBe("suspended");
  });
});
