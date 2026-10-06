import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): vendor accounts, listings and the approval rules on the real
// database, with throwaway accounts removed afterwards. No emails are sent.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn().mockResolvedValue(true) }));

describe.skipIf(!enabled)("vendor accounts and listings against MongoDB", () => {
  let svc: typeof import("./service");
  let schema: typeof import("./schema");
  let db: Db;
  const tag = `zz-mkt-${Date.now()}`;

  const account = (label: string) =>
    svc.signUpVendor(
      schema.vendorSignupSchema.parse({
        businessName: `Biz ${label}`,
        email: `${tag}-${label}@example.com`,
        phone: "98765 43210",
        password: "a-long-enough-pass",
      }),
    );
  const listing = (over: Record<string, unknown> = {}) =>
    schema.listingInputSchema.parse({
      category: "photographer",
      cities: "Jaipur, Udaipur",
      description: "Candid photography.",
      ...over,
    });
  const clean = async () => {
    const ids = (
      await db
        .collection("vendorAccounts")
        .find({ email: new RegExp(`^${tag}`) })
        .toArray()
    ).map((a) => a._id);
    await db.collection("listings").deleteMany({ vendorAccountId: { $in: ids } });
    await db.collection("vendorAccounts").deleteMany({ _id: { $in: ids } });
  };

  beforeAll(async () => {
    svc = await import("./service");
    schema = await import("./schema");
    db = await (await import("@/lib/db")).getDb();
    await svc.getVendorAuthState(new ObjectId().toHexString()); // creates the account indexes
    await svc.getMyListing(new ObjectId().toHexString());
    await clean();
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("creates an account that is unverified, stores only a password hash, and refuses a repeat email", async () => {
    const v = await account("a");
    expect(v).toMatchObject({
      businessName: "Biz a",
      emailVerified: false,
      phone: "+919876543210",
    });
    const raw = await db.collection("vendorAccounts").findOne({ _id: new ObjectId(v.id) });
    expect(raw?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(raw)).not.toContain("a-long-enough-pass");
    await expect(account("a")).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
  });

  it("logs in with the right password only, with one message for every failure", async () => {
    const ok = await svc.logInVendor({
      email: `${tag}-a@example.com`,
      password: "a-long-enough-pass",
      remember: false,
    });
    expect(ok.businessName).toBe("Biz a");
    const wrong = await svc
      .logInVendor({ email: `${tag}-a@example.com`, password: "wrong-password-1", remember: false })
      .catch((e) => e);
    const ghost = await svc
      .logInVendor({
        email: `${tag}-ghost@example.com`,
        password: "whatever-1234",
        remember: false,
      })
      .catch((e) => e);
    expect(wrong).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(wrong.message).toBe(ghost.message);
  });

  it("verifies an email once with a hashed single-use token, and resets a password with one that works once", async () => {
    const v = await account("b");
    const { queueEmail } = await import("@/lib/email");
    const mock = vi.mocked(queueEmail);
    const link = () =>
      (mock.mock.calls.at(-1)![0].payload as { url: string }).url.split("/").pop()!;

    await svc.resendVendorVerification(v.id);
    const token = link();
    const raw = await db.collection("vendorAccounts").findOne({ _id: new ObjectId(v.id) });
    expect(raw?.verifyTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(raw?.verifyTokenHash).not.toContain(token);
    await svc.confirmVendorEmail(token);
    expect((await svc.getVendorProfile(v.id))?.emailVerified).toBe(true);
    await expect(svc.confirmVendorEmail(token)).rejects.toMatchObject({ code: "LINK_INVALID" });

    await svc.requestVendorPasswordReset(`${tag}-b@example.com`);
    const reset = link();
    await svc.resetVendorPassword(reset, "a-brand-new-password");
    await expect(svc.resetVendorPassword(reset, "another-new-password")).rejects.toMatchObject({
      code: "LINK_INVALID",
    });
    await expect(
      svc.logInVendor({
        email: `${tag}-b@example.com`,
        password: "a-long-enough-pass",
        remember: false,
      }),
    ).rejects.toBeTruthy();
    await expect(
      svc.logInVendor({
        email: `${tag}-b@example.com`,
        password: "a-brand-new-password",
        remember: false,
      }),
    ).resolves.toBeTruthy();
    expect((await svc.getVendorAuthState(v.id))?.sessionsValidAfter).toBeInstanceOf(Date);
    await expect(
      svc.requestVendorPasswordReset(`${tag}-nobody@example.com`),
    ).resolves.toBeUndefined();
  });

  it("a vendor has one listing, which starts pending and keeps the account's business name", async () => {
    const v = await account("c");
    const first = await svc.saveMyListing(v.id, listing());
    expect(first).toMatchObject({
      status: "pending",
      businessName: "Biz c",
      cities: ["Jaipur", "Udaipur"],
      ratingCount: 0,
    });
    const again = await svc.saveMyListing(v.id, listing({ description: "Updated." }));
    expect(again.id).toBe(first.id);
    expect(
      await db.collection("listings").countDocuments({ vendorAccountId: new ObjectId(v.id) }),
    ).toBe(1);
    const raw = await db.collection("listings").findOne({ _id: new ObjectId(first.id) });
    expect(raw).not.toHaveProperty("startingPrice");
    expect(raw).not.toHaveProperty("links");
  });

  it("two first saves at the same moment still make just one listing", async () => {
    const v = await account("d");
    await Promise.all([
      svc.saveMyListing(v.id, listing()),
      svc.saveMyListing(v.id, listing()),
      svc.saveMyListing(v.id, listing()),
    ]);
    expect(
      await db.collection("listings").countDocuments({ vendorAccountId: new ObjectId(v.id) }),
    ).toBe(1);
  });

  it("every approval step follows the rules: only valid moves, edits go back to pending, suspension sticks", async () => {
    const v = await account("e");
    const l = await svc.saveMyListing(
      v.id,
      listing({ startingPrice: "50,000", website: "pixel.in" }),
    );
    expect(l).toMatchObject({ startingPrice: 5_000_000, website: "https://pixel.in/" });

    await expect(svc.setListingPaused(v.id, true)).rejects.toMatchObject({ code: "FORBIDDEN" }); // not live yet
    expect((await svc.decideListing(l.id, "approve")).status).toBe("approved");
    expect((await svc.setListingPaused(v.id, true)).status).toBe("paused");
    expect((await svc.setListingPaused(v.id, false)).status).toBe("approved");
    await expect(svc.setListingPaused(v.id, false)).rejects.toMatchObject({ code: "FORBIDDEN" });

    // An edit sends a live listing back for review.
    expect((await svc.saveMyListing(v.id, listing({ description: "New text" }))).status).toBe(
      "pending",
    );
    await expect(svc.decideListing(l.id, "suspend", "Spam")).resolves.toMatchObject({
      status: "suspended",
      reviewNote: "Spam",
    });
    // Editing is no way out of a suspension.
    const edited = await svc.saveMyListing(v.id, listing({ description: "Trying again" }));
    expect(edited).toMatchObject({ status: "suspended", reviewNote: "Spam" });
    await expect(svc.setListingPaused(v.id, false)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await svc.decideListing(l.id, "approve")).status).toBe("approved");
    expect((await svc.getMyListing(v.id))?.reviewNote).toBeUndefined();
  });

  it("a stale click cannot overwrite a newer decision", async () => {
    const v = await account("f");
    const l = await svc.saveMyListing(v.id, listing());
    await svc.decideListing(l.id, "reject", "Add detail");
    await expect(svc.decideListing(l.id, "reject")).rejects.toMatchObject({ code: "NOT_FOUND" }); // already rejected
    await expect(svc.decideListing(l.id, "suspend")).rejects.toMatchObject({ code: "NOT_FOUND" }); // not live
    expect((await svc.getMyListing(v.id))?.status).toBe("rejected");
    // Fixing it and resubmitting brings it back to pending, and the note clears.
    const fixed = await svc.saveMyListing(v.id, listing({ description: "More detail now" }));
    expect(fixed).toMatchObject({ status: "pending" });
    expect(fixed.reviewNote).toBeUndefined();
    await expect(svc.decideListing(new ObjectId().toHexString(), "approve")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("two staff approving at the same moment is harmless", async () => {
    const v = await account("g");
    const l = await svc.saveMyListing(v.id, listing());
    const results = await Promise.allSettled([
      svc.decideListing(l.id, "approve"),
      svc.decideListing(l.id, "approve"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    expect((await svc.getMyListing(v.id))?.status).toBe("approved");
  });

  it("the staff list shows pending first and carries the vendor's email", async () => {
    const all = await svc.listForStaff();
    const mine = all.filter((l) => l.vendorEmail.startsWith(tag));
    expect(mine.length).toBeGreaterThan(0);
    const firstPending = all.findIndex((l) => l.status === "pending");
    const lastPending = all.map((l) => l.status).lastIndexOf("pending");
    const firstOther = all.findIndex((l) => l.status !== "pending");
    if (firstPending !== -1 && firstOther !== -1) expect(lastPending).toBeLessThan(firstOther);
  });
});
