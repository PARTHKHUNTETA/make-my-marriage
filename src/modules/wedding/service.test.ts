import { ObjectId } from "mongodb";
import { MongoServerError } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WeddingDoc } from "./repository";

const session = { id: "session" };
const inTransaction = vi.hoisted(() => vi.fn());
const repo = vi.hoisted(() => ({
  insertWedding: vi.fn(),
  findWeddingById: vi.fn(),
  updateWeddingDetails: vi.fn(),
}));
const members = vi.hoisted(() => ({ getMembership: vi.fn(), addAdminMember: vi.fn() }));
vi.mock("@/lib/db", () => ({ inTransaction }));
vi.mock("./repository", () => repo);
vi.mock("@/modules/members/service", () => members);

import { createWedding, getWedding, slugCandidate, updateWeddingDetails } from "./service";

const input = {
  brideName: "Priya",
  groomName: "Aarav",
  title: "Priya weds Aarav",
  date: "2026-02-14",
  city: "Jaipur",
  venue: "Rambagh Palace",
  description: undefined,
};

function dupSlug() {
  return new MongoServerError({
    code: 11000,
    message: "E11000 duplicate key error index: website.slug_1 dup key",
    keyPattern: { "website.slug": 1 },
  });
}

beforeEach(() => {
  inTransaction.mockReset().mockImplementation((work: (s: unknown) => unknown) => work(session));
  repo.insertWedding.mockReset().mockImplementation(async (w) => ({ _id: new ObjectId(), ...w }));
  repo.findWeddingById.mockReset();
  repo.updateWeddingDetails.mockReset().mockResolvedValue(true);
  members.getMembership.mockReset().mockResolvedValue(null);
  members.addAdminMember.mockReset().mockResolvedValue(undefined);
});

describe("createWedding", () => {
  it("creates the wedding and makes the creator its admin, in one transaction", async () => {
    const { weddingId } = await createWedding("user-1", input);

    expect(inTransaction).toHaveBeenCalledOnce();
    expect(repo.insertWedding).toHaveBeenCalledOnce();
    expect(repo.insertWedding.mock.calls[0]![1]).toEqual({ session });
    expect(members.addAdminMember).toHaveBeenCalledWith(
      { userId: "user-1", weddingId },
      { session },
    );
    expect(ObjectId.isValid(weddingId)).toBe(true);
  });

  it("stores the date as midnight in India and starts private, with unguessable tokens", async () => {
    await createWedding("user-1", input);
    const stored = repo.insertWedding.mock.calls[0]![0] as Omit<
      WeddingDoc,
      "_id" | "createdAt" | "updatedAt"
    >;
    expect(stored.date.toISOString()).toBe("2026-02-13T18:30:00.000Z");
    expect(stored.website).toEqual({
      slug: "priya-weds-aarav",
      theme: "minimal",
      isOn: false,
      showGallery: false,
      showLive: false,
    });
    expect(stored.uploadsOn).toBe(false);
    expect(stored.galleryToken).toMatch(/^[0-9A-Za-z]{22}$/);
    expect(stored).toMatchObject({
      brideName: "Priya",
      groomName: "Aarav",
      city: "Jaipur",
      venue: "Rambagh Palace",
    });
  });

  it("refuses an account that already belongs to a wedding, before writing anything", async () => {
    members.getMembership.mockResolvedValue({ weddingId: "w0", role: "admin" });
    await expect(createWedding("user-1", input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(inTransaction).not.toHaveBeenCalled();
    expect(repo.insertWedding).not.toHaveBeenCalled();
  });

  it("tries the next web address when the first is taken", async () => {
    repo.insertWedding.mockRejectedValueOnce(dupSlug());
    await createWedding("user-1", input);
    const slugs = repo.insertWedding.mock.calls.map(
      (c) => (c[0] as { website: { slug: string } }).website.slug,
    );
    expect(slugs).toEqual(["priya-weds-aarav", "priya-weds-aarav-2"]);
    expect(members.addAdminMember).toHaveBeenCalledOnce(); // only the successful attempt attached an admin
  });

  it("skips reserved words, so a wedding can never shadow a page", async () => {
    await createWedding("user-1", { ...input, title: "Dashboard" });
    expect(
      (repo.insertWedding.mock.calls[0]![0] as { website: { slug: string } }).website.slug,
    ).toBe("dashboard-2");
  });

  it("falls back to a generic address when the title has no Latin letters", async () => {
    await createWedding("user-1", { ...input, title: "प्रिया और आरव" });
    expect(
      (repo.insertWedding.mock.calls[0]![0] as { website: { slug: string } }).website.slug,
    ).toBe("wedding");
  });

  it("gives up with a friendly error after ten taken addresses", async () => {
    repo.insertWedding.mockRejectedValue(dupSlug());
    await expect(createWedding("user-1", input)).rejects.toMatchObject({ code: "INTERNAL" });
    expect(repo.insertWedding).toHaveBeenCalledTimes(10);
  });

  it("does not swallow other failures", async () => {
    repo.insertWedding.mockRejectedValue(new Error("disk full"));
    await expect(createWedding("user-1", input)).rejects.toThrow("disk full");
    expect(repo.insertWedding).toHaveBeenCalledOnce();
  });

  it("surfaces 'already a member' when a concurrent request got there first", async () => {
    const { AppError } = await import("@/lib/errors");
    members.addAdminMember.mockRejectedValue(
      new AppError("FORBIDDEN", "You already belong to a wedding."),
    );
    await expect(createWedding("user-1", input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an invalid date even if validation upstream was skipped", async () => {
    await expect(createWedding("user-1", { ...input, date: "2026-02-30" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(repo.insertWedding).not.toHaveBeenCalled();
  });
});

describe("slugCandidate", () => {
  it("uses the base first, then numbered suffixes", () => {
    expect(slugCandidate("priya-weds-aarav", 0)).toBe("priya-weds-aarav");
    expect(slugCandidate("priya-weds-aarav", 1)).toBe("priya-weds-aarav-2");
    expect(slugCandidate("priya-weds-aarav", 4)).toBe("priya-weds-aarav-5");
  });

  it("keeps a long base within the length limit once the suffix is added", () => {
    expect(slugCandidate("a".repeat(50), 1).length).toBeLessThanOrEqual(50);
  });
});

describe("getWedding", () => {
  const doc = (extra: Partial<WeddingDoc> = {}) =>
    ({
      _id: new ObjectId(),
      brideName: "Priya",
      groomName: "Aarav",
      title: "Priya weds Aarav",
      date: new Date("2026-02-13T18:30:00Z"),
      city: "Jaipur",
      website: {
        slug: "priya-weds-aarav",
        theme: "minimal",
        isOn: false,
        showGallery: false,
        showLive: false,
      },
      galleryToken: "SECRETTOKEN0000000000",
      uploadsOn: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...extra,
    }) as WeddingDoc;

  it("returns a summary that leaves out tokens and settings", async () => {
    repo.findWeddingById.mockResolvedValue(doc());
    const summary = await getWedding("w-visible");
    expect(summary).toMatchObject({
      brideName: "Priya",
      groomName: "Aarav",
      city: "Jaipur",
      slug: "priya-weds-aarav",
    });
    expect(JSON.stringify(summary)).not.toContain("SECRETTOKEN");
    expect(Object.keys(summary!)).not.toContain("galleryToken");
  });

  it("treats a missing wedding as not found", async () => {
    repo.findWeddingById.mockResolvedValue(null);
    expect(await getWedding("w-missing")).toBeNull();
  });

  it("hides a wedding that has been soft-deleted", async () => {
    repo.findWeddingById.mockResolvedValue(doc({ deletedAt: new Date() }));
    expect(await getWedding("w-deleted")).toBeNull();
  });
});

describe("updateWeddingDetails", () => {
  const W = "507f1f77bcf86cd799439011";
  const edit = { ...input, venue: "Taj Lake Palace", description: "Join us!" };

  it("saves the details, with the date as midnight in India", async () => {
    await updateWeddingDetails(W, { ...edit, brideName: "Priyanka", date: "2027-02-14" });
    const [id, set, unset] = repo.updateWeddingDetails.mock.calls[0]!;
    expect(id).toBe(W);
    expect(set).toMatchObject({
      brideName: "Priyanka",
      groomName: "Aarav",
      city: "Jaipur",
      venue: "Taj Lake Palace",
      description: "Join us!",
    });
    expect(set.date.toISOString()).toBe("2027-02-13T18:30:00.000Z");
    expect(unset).toEqual([]);
  });

  it("removes a venue or welcome message that was cleared, rather than storing it empty", async () => {
    await updateWeddingDetails(W, { ...input, venue: undefined, description: undefined });
    const [, set, unset] = repo.updateWeddingDetails.mock.calls[0]!;
    expect(unset.sort()).toEqual(["description", "venue"]);
    expect("venue" in set).toBe(false);
    expect("description" in set).toBe(false);
  });

  it("clears only the field that was cleared", async () => {
    await updateWeddingDetails(W, { ...input, venue: "Taj", description: undefined });
    expect(repo.updateWeddingDetails.mock.calls[0]![2]).toEqual(["description"]);
  });

  it("never touches the web address, the gallery link or the website settings", async () => {
    await updateWeddingDetails(W, { ...edit, title: "A completely different title" });
    const set = repo.updateWeddingDetails.mock.calls[0]![1];
    expect(Object.keys(set).sort()).toEqual([
      "brideName",
      "city",
      "date",
      "description",
      "groomName",
      "title",
      "venue",
    ]);
  });

  it("rejects an invalid date without writing", async () => {
    await expect(updateWeddingDetails(W, { ...edit, date: "2027-02-30" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(repo.updateWeddingDetails).not.toHaveBeenCalled();
  });

  it("reports NOT_FOUND when there is no live wedding to update", async () => {
    repo.updateWeddingDetails.mockResolvedValue(false);
    await expect(updateWeddingDetails(W, edit)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
