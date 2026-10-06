import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const requireUser = vi.hoisted(() => vi.fn());
const requireMember = vi.hoisted(() => vi.fn());
const createWedding = vi.hoisted(() => vi.fn());
const updateWeddingDetails = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireUser, requireMember }));
vi.mock("./service", () => ({ createWedding, updateWeddingDetails }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createWeddingAction, updateWeddingAction } from "./actions";

const valid = {
  brideName: "Priya",
  groomName: "Aarav",
  title: "Priya weds Aarav",
  date: "2026-02-14",
  city: "Jaipur",
};

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ kind: "user", userId: "u1" });
  createWedding.mockReset().mockResolvedValue({ weddingId: "w1" });
  requireMember
    .mockReset()
    .mockResolvedValue({ kind: "member", userId: "u1", weddingId: "w1", role: "manager" });
  updateWeddingDetails.mockReset().mockResolvedValue(undefined);
  revalidatePath.mockReset();
});

describe("createWeddingAction", () => {
  it("creates the wedding for the signed-in account and returns its id", async () => {
    expect(await createWeddingAction(valid)).toEqual({ ok: true, data: { weddingId: "w1" } });
    expect(createWedding).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ brideName: "Priya", city: "Jaipur" }),
    );
  });

  it("takes the account from the session, never from the input", async () => {
    await createWeddingAction({ ...valid, userId: "attacker", weddingId: "other" });
    expect(createWedding.mock.calls[0]![0]).toBe("u1");
    expect(JSON.stringify(createWedding.mock.calls[0]![1])).not.toContain("attacker");
  });

  it("requires sign-in, and does nothing else when it is missing", async () => {
    requireUser.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in to continue"));
    expect(await createWeddingAction(valid)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(createWedding).not.toHaveBeenCalled();
  });

  it("validates before any work happens", async () => {
    const result = await createWeddingAction({ ...valid, city: "", date: "nope" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    if (!result.ok)
      expect(Object.keys(result.error.details as object).sort()).toEqual(["city", "date"]);
    expect(createWedding).not.toHaveBeenCalled();
  });

  it("returns service errors as values", async () => {
    createWedding.mockRejectedValue(new AppError("FORBIDDEN", "You already belong to a wedding."));
    expect(await createWeddingAction(valid)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("rejects input that is not an object", async () => {
    for (const bad of [null, undefined, "x", 42]) {
      expect(await createWeddingAction(bad)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
    }
  });
});

describe("updateWeddingAction", () => {
  it("lets a Manager edit the details, using their own wedding", async () => {
    expect(await updateWeddingAction({ ...valid, weddingId: "someone-elses" })).toEqual({
      ok: true,
      data: {},
    });
    expect(updateWeddingDetails).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({ brideName: "Priya", city: "Jaipur" }),
    );
    expect(JSON.stringify(updateWeddingDetails.mock.calls[0])).not.toContain("someone-elses");
  });

  it("refreshes every page that shows the details", async () => {
    await updateWeddingAction(valid);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("requires a wedding: an account that has not set one up is turned away", async () => {
    requireMember.mockRejectedValue(new AppError("FORBIDDEN", "Set up your wedding first"));
    expect(await updateWeddingAction(valid)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(updateWeddingDetails).not.toHaveBeenCalled();
  });

  it("requires sign-in", async () => {
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in to continue"));
    expect(await updateWeddingAction(valid)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("validates before saving, with field details", async () => {
    const result = await updateWeddingAction({ ...valid, brideName: "", date: "nope" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    if (!result.ok)
      expect(Object.keys(result.error.details as object).sort()).toEqual(["brideName", "date"]);
    expect(updateWeddingDetails).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a service failure as a value and does not refresh", async () => {
    updateWeddingDetails.mockRejectedValue(
      new AppError("NOT_FOUND", "We couldn't find your wedding."),
    );
    expect(await updateWeddingAction(valid)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
