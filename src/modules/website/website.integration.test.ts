import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): website settings and the public site on the real database,
// with two throwaway weddings removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("the wedding website against MongoDB", () => {
  let wedding: typeof import("@/modules/wedding/service");
  let site: typeof import("./service");
  let schema: typeof import("./schema");
  let events: typeof import("@/modules/events/service");
  let eventSchema: typeof import("@/modules/events/schema");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();
  const tag = `zz-site-${Date.now()}`;

  const doc = (id: ObjectId, slug: string, over: Record<string, unknown> = {}) => ({
    _id: id,
    brideName: "Priya",
    groomName: "Aarav",
    title: "Priya weds Aarav",
    date: new Date("2099-02-14T00:00:00+05:30"),
    city: "Jaipur",
    description: "Welcome!",
    website: { slug, theme: "minimal", isOn: false, showGallery: false, showLive: false },
    galleryToken: `zz${id.toHexString()}`,
    uploadsOn: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });
  const settings = (over: Record<string, unknown> = {}) =>
    schema.websiteSettingsSchema.parse({
      isOn: true,
      theme: "classical",
      slug: `${tag}-a`,
      showLive: false,
      youtubeUrl: "",
      ...over,
    });
  const clean = async () => {
    await db.collection("weddings").deleteMany({ _id: { $in: [wA, wB] } });
    await db.collection("events").deleteMany({ weddingId: { $in: [wA, wB] } });
  };

  beforeAll(async () => {
    wedding = await import("@/modules/wedding/service");
    site = await import("./service");
    schema = await import("./schema");
    events = await import("@/modules/events/service");
    eventSchema = await import("@/modules/events/schema");
    db = await (await import("@/lib/db")).getDb();
    await wedding.getWedding(new ObjectId().toHexString()); // creates the indexes
    await events.listEvents(A);
    await clean();
    await db
      .collection("weddings")
      .insertMany([doc(wA, `${tag}-orig-a`), doc(wB, `${tag}-orig-b`)]);
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("a site is hidden until it is switched on, then served at its address", async () => {
    expect(await site.getPublicSite(`${tag}-orig-a`)).toBeNull();
    await site.saveWebsiteSettings(A, settings({ slug: `${tag}-a`, isOn: false }));
    expect(await site.getPublicSite(`${tag}-a`)).toBeNull();
    expect((await site.getSitePreview(A))?.isPreview).toBe(true);
    await site.saveWebsiteSettings(A, settings({ slug: `${tag}-a`, isOn: true }));
    expect(await site.getPublicSite(`${tag}-a`)).toMatchObject({
      brideName: "Priya",
      theme: "classical",
    });
  });

  it("changing the address moves the site: the old one stops working", async () => {
    await site.saveWebsiteSettings(A, settings({ slug: `${tag}-moved` }));
    expect(await site.getPublicSite(`${tag}-a`)).toBeNull();
    expect(await site.getPublicSite(`${tag}-moved`)).not.toBeNull();
  });

  it("two weddings cannot share an address, and the loser keeps its own", async () => {
    await expect(
      site.saveWebsiteSettings(B, settings({ slug: `${tag}-moved` })),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { slug: [expect.stringMatching(/taken/i)] },
    });
    expect((await wedding.getWedding(B))?.website.slug).toBe(`${tag}-orig-b`);
  });

  it("two people choosing the same free address at the same moment: exactly one gets it", async () => {
    const results = await Promise.allSettled([
      site.saveWebsiteSettings(A, settings({ slug: `${tag}-race` })),
      site.saveWebsiteSettings(B, settings({ slug: `${tag}-race` })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.collection("weddings").countDocuments({ "website.slug": `${tag}-race` })).toBe(
      1,
    );
  });

  it("settings never touch another wedding", async () => {
    const before = await db.collection("weddings").findOne({ _id: wB });
    await site.saveWebsiteSettings(A, settings({ slug: `${tag}-a2`, theme: "modern", isOn: true }));
    expect(await db.collection("weddings").findOne({ _id: wB })).toEqual(before);
  });

  it("the live stream shows only when on with a valid link, and clearing the link removes it", async () => {
    const url = "https://youtu.be/dQw4w9WgXcQ";
    await site.saveWebsiteSettings(
      A,
      settings({ slug: `${tag}-live`, showLive: true, youtubeUrl: url }),
    );
    expect((await site.getPublicSite(`${tag}-live`))?.live?.embedUrl).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(await db.collection("weddings").findOne({ _id: wA })).toMatchObject({
      liveStream: { youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", isOn: true },
    });
    await site.saveWebsiteSettings(
      A,
      settings({ slug: `${tag}-live`, showLive: false, youtubeUrl: url }),
    );
    expect((await site.getPublicSite(`${tag}-live`))?.live).toBeUndefined();
    await site.saveWebsiteSettings(
      A,
      settings({ slug: `${tag}-live`, showLive: true, youtubeUrl: "" }),
    );
    expect((await site.getPublicSite(`${tag}-live`))?.live).toBeUndefined();
    expect(await db.collection("weddings").findOne({ _id: wA })).not.toHaveProperty(
      "liveStream.youtubeUrl",
    );
  });

  it("the site lists only events marked for the website, from this wedding only", async () => {
    const mk = (name: string, over: Record<string, unknown> = {}) =>
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name,
        date: "2099-02-13",
        startTime: "19:00",
        ...over,
      });
    await events.createEvent(
      A,
      mk("Public sangeet", { venueName: "Royal Garden", showOnWebsite: true }),
    );
    await events.createEvent(A, mk("Private roka", { showOnWebsite: false }));
    await events.createEvent(B, mk("Other wedding event"));
    const names = (await site.getPublicSite(`${tag}-live`))?.events.map((e) => e.name);
    expect(names).toEqual(["Public sangeet"]);
  });

  it("a deleted wedding's site is gone", async () => {
    await db.collection("weddings").updateOne({ _id: wA }, { $set: { deletedAt: new Date() } });
    expect(await site.getPublicSite(`${tag}-live`)).toBeNull();
  });
});
