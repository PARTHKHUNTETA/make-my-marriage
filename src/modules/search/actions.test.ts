import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const requireMember = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const searchWedding = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("@/lib/ratelimit", () => ({
  consumeRateLimit,
  subjectKey: (a: string, b: string) => `${a}:${b}`,
}));
vi.mock("./service", () => ({ searchWedding }));

import { searchAction } from "./actions";

beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1", memberId: "m1" });
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  searchWedding
    .mockReset()
    .mockResolvedValue([{ kind: "guest", id: "g", title: "Meera", href: "/guests/g" }]);
});

describe("searchAction", () => {
  it("searches the signed-in member's own wedding, whatever the input says", async () => {
    const r = await searchAction({ q: "meera", weddingId: "evil", memberId: "evil" });
    expect(r).toMatchObject({ ok: true, data: [{ title: "Meera" }] });
    expect(searchWedding).toHaveBeenCalledWith("w1", "m1", "meera");
  });

  it("tidies the words typed, and refuses too short, too long or missing", async () => {
    await searchAction({ q: "  meera    shah  " });
    expect(searchWedding).toHaveBeenLastCalledWith("w1", "m1", "meera shah");
    for (const bad of [{ q: "m" }, { q: "   " }, { q: "x".repeat(81) }, {}, { q: 5 }, null]) {
      expect(await searchAction(bad)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
    }
    expect(searchWedding).toHaveBeenCalledTimes(1);
  });

  it("is limited per person", async () => {
    await searchAction({ q: "meera" });
    expect(consumeRateLimit).toHaveBeenCalledWith(
      "search",
      "member:m1",
      expect.objectContaining({ limit: 600 }),
    );
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Too many attempts."));
    expect(await searchAction({ q: "meera" })).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
  });

  it("needs a signed-in member, and searches nothing without one", async () => {
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in to continue"));
    expect(await searchAction({ q: "meera" })).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(searchWedding).not.toHaveBeenCalled();
  });
});
