import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): reviews, replies and the listing rating on the real database,
// with throwaway vendors removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn().mockResolvedValue(true) }));

describe.skipIf(!enabled)("reviews against MongoDB", () => {
  let mkt: typeof import("./service");
  let schema: typeof import("./schema");
  let db: Db;
  const tag = `zz-rv-${Date.now()}`;
  const [w1, w2, w3] = [
    new ObjectId().toHexString(),
    new ObjectId().toHexString(),
    new ObjectId().toHexString(),
  ];

  const vendor = async (label: string) => {
    const profile = await mkt.signUpVendor(
      schema.vendorSignupSchema.parse({
        businessName: `${tag} ${label}`,
        email: `${tag}-${label}@example.com`,
        phone: "98765 43210",
        password: "a-long-enough-pass",
      }),
    );
    const listing = await mkt.saveMyListing(
      profile.id,
      schema.listingInputSchema.parse({
        category: "dj",
        cities: "Pune",
        description: `About ${label}`,
      }),
    );
    await mkt.decideListing(listing.id, "approve");
    return { accountId: profile.id, listingId: listing.id };
  };
  const review = (listingId: string, rating: number, text?: string) =>
    schema.reviewSchema.parse({ listingId, rating, text });
  const rating = async (listingId: string) => {
    const l = await mkt.getLiveListing(listingId);
    return { avg: l?.ratingAvg, count: l?.ratingCount };
  };
  const clean = async () => {
    const accounts = (
      await db
        .collection("vendorAccounts")
        .find({ email: new RegExp(`^${tag}`) })
        .toArray()
    ).map((a) => a._id);
    const listings = (
      await db
        .collection("listings")
        .find({ vendorAccountId: { $in: accounts } })
        .toArray()
    ).map((l) => l._id);
    await db.collection("reviews").deleteMany({ listingId: { $in: listings } });
    await db.collection("listings").deleteMany({ _id: { $in: listings } });
    await db.collection("vendorAccounts").deleteMany({ _id: { $in: accounts } });
  };

  beforeAll(async () => {
    mkt = await import("./service");
    schema = await import("./schema");
    db = await (await import("@/lib/db")).getDb();
    await mkt.getMyListing(new ObjectId().toHexString());
    await mkt.getVendorAuthState(new ObjectId().toHexString());
    await mkt.getMyReview(w1, new ObjectId().toHexString());
    await clean();
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("a listing with no reviews has no rating, and each review moves the average", async () => {
    const v = await vendor("avg");
    expect(await rating(v.listingId)).toEqual({ avg: undefined, count: 0 });
    await mkt.saveReview(w1, review(v.listingId, 5, "Brilliant"));
    expect(await rating(v.listingId)).toEqual({ avg: 5, count: 1 });
    await mkt.saveReview(w2, review(v.listingId, 4));
    await mkt.saveReview(w3, review(v.listingId, 2));
    const r = await rating(v.listingId);
    expect(r.count).toBe(3);
    expect(r.avg).toBeCloseTo(3.67, 2);
  });

  it("one review per wedding per vendor: writing again changes it and keeps the vendor's reply", async () => {
    const v = await vendor("once");
    const first = await mkt.saveReview(w1, review(v.listingId, 3, "Okay"));
    await mkt.replyToReview(v.accountId, first.id, "Thanks for the feedback");
    const second = await mkt.saveReview(w1, review(v.listingId, 5, "Better on reflection"));
    expect(second.id).toBe(first.id);
    expect(
      await db.collection("reviews").countDocuments({ listingId: new ObjectId(v.listingId) }),
    ).toBe(1);
    expect(await mkt.getMyReview(w1, v.listingId)).toMatchObject({
      rating: 5,
      text: "Better on reflection",
      vendorReply: "Thanks for the feedback",
    });
    expect(await rating(v.listingId)).toEqual({ avg: 5, count: 1 });
    // Clearing the text removes it rather than storing nothing.
    await mkt.saveReview(w1, review(v.listingId, 5));
    expect(
      await db.collection("reviews").findOne({ _id: new ObjectId(first.id) }),
    ).not.toHaveProperty("text");
  });

  it("two first reviews from the same wedding at the same moment make one", async () => {
    const v = await vendor("race");
    await Promise.all([
      mkt.saveReview(w1, review(v.listingId, 1)),
      mkt.saveReview(w1, review(v.listingId, 5)),
      mkt.saveReview(w1, review(v.listingId, 3)),
    ]);
    expect(
      await db.collection("reviews").countDocuments({ listingId: new ObjectId(v.listingId) }),
    ).toBe(1);
    expect((await rating(v.listingId)).count).toBe(1);
  });

  it("reviews of one vendor never touch another's rating", async () => {
    const a = await vendor("a");
    const b = await vendor("b");
    await mkt.saveReview(w1, review(a.listingId, 5));
    expect(await rating(b.listingId)).toEqual({ avg: undefined, count: 0 });
    expect(await mkt.getListingReviews(b.listingId)).toEqual([]);
  });

  it("a vendor can reply once, only to reviews about them", async () => {
    const v = await vendor("reply");
    const other = await vendor("replyother");
    const r = await mkt.saveReview(w1, review(v.listingId, 4, "Good"));
    await expect(mkt.replyToReview(other.accountId, r.id, "Not mine")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await mkt.replyToReview(v.accountId, r.id, "Thank you!");
    await expect(mkt.replyToReview(v.accountId, r.id, "Changing my mind")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await mkt.listMyReviews(v.accountId))[0]).toMatchObject({ vendorReply: "Thank you!" });
    expect((await mkt.getListingReviews(v.listingId))[0]).toMatchObject({
      vendorReply: "Thank you!",
    });
  });

  it("two replies at the same moment save exactly one", async () => {
    const v = await vendor("tworeply");
    const r = await mkt.saveReview(w1, review(v.listingId, 4));
    const results = await Promise.allSettled([
      mkt.replyToReview(v.accountId, r.id, "First"),
      mkt.replyToReview(v.accountId, r.id, "Second"),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("what a listing shows about a review carries no wedding identity", async () => {
    const v = await vendor("anon");
    await mkt.saveReview(w1, review(v.listingId, 5, "Great"));
    const json = JSON.stringify(await mkt.getListingReviews(v.listingId));
    expect(json).not.toContain(w1);
    expect(json).not.toContain("weddingId");
    expect(json).not.toContain(v.accountId);
  });

  it("the team removing a review recomputes the rating, back to none if it was the last", async () => {
    const v = await vendor("remove");
    const a = await mkt.saveReview(w1, review(v.listingId, 1, "Abusive nonsense"));
    const b = await mkt.saveReview(w2, review(v.listingId, 5));
    expect((await rating(v.listingId)).avg).toBe(3);
    await mkt.removeReview(a.id);
    expect(await rating(v.listingId)).toEqual({ avg: 5, count: 1 });
    await expect(mkt.removeReview(a.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await mkt.removeReview(b.id);
    expect(await rating(v.listingId)).toEqual({ avg: undefined, count: 0 });
    expect(
      await db.collection("listings").findOne({ _id: new ObjectId(v.listingId) }),
    ).not.toHaveProperty("ratingAvg");
  });

  it("the marketplace sorts by rating, with unrated vendors last", async () => {
    const low = await vendor("low");
    const high = await vendor("high");
    await vendor("unrated");
    await mkt.saveReview(w1, review(low.listingId, 2));
    await mkt.saveReview(w1, review(high.listingId, 5));
    // This file's own earlier vendors fill the first page, so read every page, in order.
    const all: string[] = [];
    for (let page = 1; page <= 6; page++) {
      const { items } = await mkt.browseListings({
        sort: "rating",
        city: "Pune",
        category: "dj",
        page,
      });
      all.push(...items.map((l) => l.businessName.replace(`${tag} `, "")));
    }
    const names = all.filter((n) => ["low", "high", "unrated"].includes(n));
    expect(names).toEqual(["high", "low", "unrated"]);
  });

  it("the staff list has the newest first, with the vendor's name", async () => {
    const v = await vendor("staff");
    await mkt.saveReview(w3, review(v.listingId, 4, "Newest"));
    const first = (await mkt.listReviewsForStaff()).find((r) => r.businessName === `${tag} staff`);
    expect(first).toMatchObject({ rating: 4, text: "Newest" });
  });
});
