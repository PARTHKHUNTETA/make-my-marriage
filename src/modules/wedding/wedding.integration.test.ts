import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): updates a throwaway wedding on the real database.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("editing wedding details against MongoDB", () => {
  let svc: typeof import("./service");
  let db: Db;
  const id = new ObjectId();
  const other = new ObjectId();
  const w = id.toHexString();
  const base = {
    brideName: "Priya",
    groomName: "Aarav",
    title: "Priya weds Aarav",
    date: "2027-02-14",
    city: "Jaipur",
    venue: undefined,
    description: undefined,
  };

  const doc = (_id: ObjectId, slug: string) => ({
    _id,
    brideName: "Priya",
    groomName: "Aarav",
    title: "Priya weds Aarav",
    date: new Date("2027-02-13T18:30:00Z"),
    city: "Jaipur",
    venue: "Rambagh Palace",
    description: "Welcome!",
    website: { slug, theme: "minimal", isOn: false, showGallery: false, showLive: false },
    galleryToken: `zz${_id.toHexString()}`,
    uploadsOn: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  });

  beforeAll(async () => {
    svc = await import("./service");
    const { getDb } = await import("@/lib/db");
    db = await getDb();
    await svc.getWedding(new ObjectId().toHexString()); // creates the indexes
    await db
      .collection("weddings")
      .insertMany([doc(id, `zz-edit-${id}`), doc(other, `zz-edit-${other}`)]);
  });
  afterAll(async () => {
    if (db) await db.collection("weddings").deleteMany({ _id: { $in: [id, other] } });
  });

  it("changes the details, stores the date as midnight in India, and bumps updatedAt", async () => {
    await svc.updateWeddingDetails(w, {
      ...base,
      brideName: "Priyanka",
      city: "Udaipur",
      date: "2027-03-01",
      venue: "Taj Lake Palace",
      description: "New message",
    });
    const saved = await db.collection("weddings").findOne({ _id: id });
    expect(saved).toMatchObject({
      brideName: "Priyanka",
      city: "Udaipur",
      venue: "Taj Lake Palace",
      description: "New message",
    });
    expect(saved?.date.toISOString()).toBe("2027-02-28T18:30:00.000Z");
    expect(saved?.updatedAt.getTime()).toBeGreaterThan(new Date("2026-01-01").getTime());
  });

  it("removes a venue and message that were cleared (the fields disappear, they are not stored empty)", async () => {
    await svc.updateWeddingDetails(w, { ...base, venue: undefined, description: undefined });
    const saved = await db.collection("weddings").findOne({ _id: id });
    expect("venue" in saved!).toBe(false);
    expect("description" in saved!).toBe(false);
  });

  it("leaves the web address, gallery token and website settings alone, even when the title changes", async () => {
    const before = await db.collection("weddings").findOne({ _id: id });
    await svc.updateWeddingDetails(w, { ...base, title: "Something entirely new" });
    const after = await db.collection("weddings").findOne({ _id: id });
    expect(after?.title).toBe("Something entirely new");
    expect(after?.website).toEqual(before?.website);
    expect(after?.galleryToken).toBe(before?.galleryToken);
    expect(after?.uploadsOn).toBe(before?.uploadsOn);
  });

  it("does not touch another wedding", async () => {
    const before = await db.collection("weddings").findOne({ _id: other });
    await svc.updateWeddingDetails(w, { ...base, brideName: "Changed", city: "Changed" });
    expect(await db.collection("weddings").findOne({ _id: other })).toEqual(before);
  });

  it("reports NOT_FOUND for a wedding that does not exist or has been deleted", async () => {
    await expect(
      svc.updateWeddingDetails(new ObjectId().toHexString(), base),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.collection("weddings").updateOne({ _id: other }, { $set: { deletedAt: new Date() } });
    await expect(svc.updateWeddingDetails(other.toHexString(), base)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await db.collection("weddings").findOne({ _id: other }))?.brideName).toBe("Priya"); // untouched
  });
});
