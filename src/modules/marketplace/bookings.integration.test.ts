import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): browsing, booking requests and accepting a quote on the real
// database, with throwaway vendors and two throwaway weddings removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn().mockResolvedValue(true) }));

describe.skipIf(!enabled)("marketplace and bookings against MongoDB", () => {
  let mkt: typeof import("./service");
  let schema: typeof import("./schema");
  let vendors: typeof import("@/modules/vendors/service");
  let db: Db;
  const tag = `zz-bk-${Date.now()}`;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();
  const ev1 = new ObjectId().toHexString();
  const ev2 = new ObjectId().toHexString();
  const snap = (...names: string[]) => ({
    ids: [ev1, ev2].slice(0, names.length),
    snapshots: names.map((name) => ({ name, date: new Date("2027-02-13T00:00:00+05:30") })),
  });

  const vendor = async (label: string, over: Record<string, unknown> = {}, approve = true) => {
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
        category: "florist",
        cities: "Pune, Nashik",
        description: `About ${label}`,
        ...over,
      }),
    );
    if (approve) await mkt.decideListing(listing.id, "approve");
    return { accountId: profile.id, listingId: listing.id };
  };
  const request = (listingId: string, over: Record<string, unknown> = {}) =>
    schema.bookingRequestSchema.parse({ listingId, eventIds: [ev1], city: "Pune", ...over });
  const clean = async () => {
    const accounts = (
      await db
        .collection("vendorAccounts")
        .find({ email: new RegExp(`^${tag}`) })
        .toArray()
    ).map((a) => a._id);
    await db.collection("bookingRequests").deleteMany({ weddingId: { $in: [wA, wB] } });
    await db.collection("vendors").deleteMany({ weddingId: { $in: [wA, wB] } });
    await db.collection("listings").deleteMany({ vendorAccountId: { $in: accounts } });
    await db.collection("notifications").deleteMany({ recipientId: { $in: accounts } });
    await db.collection("vendorAccounts").deleteMany({ _id: { $in: accounts } });
  };

  beforeAll(async () => {
    mkt = await import("./service");
    schema = await import("./schema");
    vendors = await import("@/modules/vendors/service");
    db = await (await import("@/lib/db")).getDb();
    await mkt.getMyListing(new ObjectId().toHexString());
    await mkt.getVendorAuthState(new ObjectId().toHexString());
    await mkt.listBookings(A);
    await vendors.listVendors(A);
    await clean();
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("couples see only approved listings, and filter by category, city (any case), price and sort", async () => {
    const cheap = await vendor("cheap", { startingPrice: "10,000" });
    const dear = await vendor("dear", {
      startingPrice: "90,000",
      cities: "Mumbai",
      category: "venue",
    });
    const noPrice = await vendor("noprice");
    await vendor("hidden", { startingPrice: "5,000" }, false); // pending: never shown
    const names = async (q: Partial<import("./schema").ListingQuery>) =>
      (await mkt.browseListings({ sort: "price_low", page: 1, ...q })).items.map((l) =>
        l.businessName.replace(`${tag} `, ""),
      );
    const mine = (all: string[]) =>
      all.filter((n) => ["cheap", "dear", "noprice", "hidden"].includes(n));

    expect(mine(await names({ sort: "price_low" }))).toEqual(["cheap", "dear", "noprice"]);
    expect(mine(await names({ sort: "price_high" }))).toEqual(["dear", "cheap", "noprice"]);
    expect(mine(await names({ city: "mumbai" }))).toEqual(["dear"]);
    expect(mine(await names({ city: "PUNE", category: "florist" }))).toEqual(["cheap", "noprice"]);
    expect(mine(await names({ minPrice: 2_000_000 }))).toEqual(["dear"]);
    expect(mine(await names({ maxPrice: 2_000_000 }))).toEqual(["cheap"]);
    expect(await mkt.getLiveListing(cheap.listingId)).toMatchObject({
      businessName: `${tag} cheap`,
    });
    expect(await mkt.getLiveListing(dear.listingId)).not.toBeNull();
    expect((await mkt.getLiveListing(noPrice.listingId))?.startingPrice).toBeUndefined();
  });

  it("a city with regex characters is matched literally", async () => {
    const r = await mkt.browseListings({ city: ".*", sort: "rating", page: 1 });
    expect(r.items).toEqual([]);
  });

  it("a paused or edited listing disappears from the marketplace until it is live again", async () => {
    const v = await vendor("pausable");
    expect(await mkt.getLiveListing(v.listingId)).not.toBeNull();
    await mkt.setListingPaused(v.accountId, true);
    expect(await mkt.getLiveListing(v.listingId)).toBeNull();
    await mkt.setListingPaused(v.accountId, false);
    await mkt.saveMyListing(
      v.accountId,
      schema.listingInputSchema.parse({
        category: "florist",
        cities: "Pune",
        description: "Edited",
      }),
    );
    expect(await mkt.getLiveListing(v.listingId)).toBeNull();
  });

  it("a request is sent once per listing, and the vendor sees only what the couple sent", async () => {
    const v = await vendor("req");
    const sent = await mkt.sendBookingRequest(
      A,
      request(v.listingId, {
        message: "Mandap decor",
        expectedHeadcount: "250",
        contactName: "Priya",
        contactPhone: "98765 43210",
      }),
      snap("Sangeet"),
    );
    expect(sent).toMatchObject({
      status: "sent",
      businessName: `${tag} req`,
      expectedHeadcount: 250,
    });
    await expect(
      mkt.sendBookingRequest(A, request(v.listingId), snap("Sangeet")),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    // Another wedding can send its own.
    await expect(
      mkt.sendBookingRequest(B, request(v.listingId), snap("Haldi")),
    ).resolves.toMatchObject({ status: "sent" });

    const inbox = await mkt.listVendorBookings(v.accountId);
    expect(inbox).toHaveLength(2);
    const view = inbox.find((r) => r.id === sent.id)!;
    expect(view).toMatchObject({
      city: "Pune",
      message: "Mandap decor",
      contactName: "Priya",
      contactPhone: "+919876543210",
    });
    expect(view.events).toEqual([{ name: "Sangeet", date: new Date("2027-02-13T00:00:00+05:30") }]);
    // Nothing that could identify or reach into the wedding.
    const json = JSON.stringify(inbox);
    for (const secret of [A, B, ev1, "weddingId", "eventIds"]) expect(json).not.toContain(secret);
  });

  it("a request to a listing that is not live is refused", async () => {
    const hidden = await vendor("notlive", {}, false);
    await expect(
      mkt.sendBookingRequest(A, request(hidden.listingId), snap("Sangeet")),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("only the right vendor can answer, only while open, and a quote can be revised", async () => {
    const v = await vendor("quote");
    const other = await vendor("other");
    const r = await mkt.sendBookingRequest(A, request(v.listingId), snap("Sangeet"));
    await expect(mkt.quoteRequest(other.accountId, r.id, 100)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(mkt.declineRequest(other.accountId, r.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await mkt.quoteRequest(v.accountId, r.id, 5_000_000);
    await mkt.quoteRequest(v.accountId, r.id, 4_500_000); // revised
    expect((await mkt.listBookings(A)).find((b) => b.id === r.id)).toMatchObject({
      status: "quoted",
      quotedAmount: 4_500_000,
    });
    await mkt.declineRequest(v.accountId, r.id);
    await expect(mkt.quoteRequest(v.accountId, r.id, 1)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await mkt.listBookings(A)).find((b) => b.id === r.id)?.status).toBe("declined");
    // A declined request frees the wedding to ask again.
    await expect(
      mkt.sendBookingRequest(A, request(v.listingId), snap("Sangeet")),
    ).resolves.toMatchObject({ status: "sent" });
  });

  it("only the sending wedding can cancel, and only while open", async () => {
    const v = await vendor("cancel");
    const r = await mkt.sendBookingRequest(A, request(v.listingId), snap("Sangeet"));
    await expect(mkt.cancelBooking(B, r.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await mkt.cancelBooking(A, r.id);
    await expect(mkt.cancelBooking(A, r.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(mkt.quoteRequest(v.accountId, r.id, 100)).rejects.toMatchObject({
      code: "NOT_FOUND",
    }); // cancelled means closed
    expect((await mkt.listBookings(B)).find((b) => b.id === r.id)).toBeUndefined();
  });

  it("accepting a quote adds the vendor to My Vendors with the agreed cost, events and contacts", async () => {
    const v = await vendor("accept");
    const r = await mkt.sendBookingRequest(
      A,
      request(v.listingId, { eventIds: [ev1, ev2] }),
      snap("Sangeet", "Wedding"),
    );
    await expect(mkt.acceptQuote(A, r.id, 100)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    }); // nothing quoted yet
    await mkt.quoteRequest(v.accountId, r.id, 7_500_000);
    await expect(mkt.acceptQuote(B, r.id, 7_500_000)).rejects.toMatchObject({ code: "NOT_FOUND" }); // not their request

    await mkt.acceptQuote(A, r.id, 7_500_000);

    expect((await mkt.listBookings(A)).find((b) => b.id === r.id)?.status).toBe("accepted");
    const mine = await vendors.getVendorByListing(A, v.listingId);
    expect(mine).toMatchObject({
      name: `${tag} accept`,
      category: "florist",
      totalCost: 7_500_000,
      phone: "+919876543210",
      email: `${tag}-accept@example.com`,
      eventIds: [ev1, ev2],
    });
    expect(await vendors.getVendorByListing(B, v.listingId)).toBeNull();
    // Can't ask again, and can't accept twice.
    await expect(
      mkt.sendBookingRequest(A, request(v.listingId), snap("Sangeet")),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(mkt.acceptQuote(A, r.id, 7_500_000)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(
      await db
        .collection("vendors")
        .countDocuments({ weddingId: wA, listingId: new ObjectId(v.listingId) }),
    ).toBe(1);
  });

  it("a quote that changed after the couple looked cannot be accepted by mistake", async () => {
    const v = await vendor("changed");
    const r = await mkt.sendBookingRequest(A, request(v.listingId), snap("Sangeet"));
    await mkt.quoteRequest(v.accountId, r.id, 3_000_000);
    await mkt.quoteRequest(v.accountId, r.id, 9_000_000); // the vendor raised the price
    await expect(mkt.acceptQuote(A, r.id, 3_000_000)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect((await mkt.listBookings(A)).find((b) => b.id === r.id)?.status).toBe("quoted");
    expect(await vendors.getVendorByListing(A, v.listingId)).toBeNull();
    await mkt.acceptQuote(A, r.id, 9_000_000);
    expect((await vendors.getVendorByListing(A, v.listingId))?.totalCost).toBe(9_000_000);
  });

  it("two clicks on Accept at the same moment add the vendor once", async () => {
    const v = await vendor("double");
    const r = await mkt.sendBookingRequest(A, request(v.listingId), snap("Sangeet"));
    await mkt.quoteRequest(v.accountId, r.id, 1_000_000);
    const results = await Promise.allSettled([
      mkt.acceptQuote(A, r.id, 1_000_000),
      mkt.acceptQuote(A, r.id, 1_000_000),
      mkt.acceptQuote(A, r.id, 1_000_000),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(
      await db
        .collection("vendors")
        .countDocuments({ weddingId: wA, listingId: new ObjectId(v.listingId) }),
    ).toBe(1);
  });

  it("acceptance is all or nothing: if the vendor cannot be added, the request stays quoted", async () => {
    const v = await vendor("atomic");
    const r = await mkt.sendBookingRequest(A, request(v.listingId), snap("Sangeet"));
    await mkt.quoteRequest(v.accountId, r.id, 2_000_000);
    // The vendor is already in My Vendors (added another way), so adding it again must fail...
    await db.collection("vendors").insertOne({
      _id: new ObjectId(),
      weddingId: wA,
      name: "Already here",
      category: "florist",
      installments: [],
      listingId: new ObjectId(v.listingId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(mkt.acceptQuote(A, r.id, 2_000_000)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    // ...and the request must not be left accepted.
    expect((await mkt.listBookings(A)).find((b) => b.id === r.id)?.status).toBe("quoted");
  });
});
