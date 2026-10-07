import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMember = vi.hoisted(() => vi.fn());
const discoverVendors = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("./service", () => ({ discoverVendors }));

import { discoverAction } from "./actions";

beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1" });
  discoverVendors.mockReset().mockResolvedValue({ configured: true, places: [] });
});

describe("discoverAction", () => {
  it("searches for the signed-in wedding whatever the input says", async () => {
    const r = await discoverAction({ category: "venue", city: " Pune ", weddingId: "evil" });
    expect(r).toMatchObject({ ok: true });
    expect(discoverVendors).toHaveBeenCalledWith("w1", { category: "venue", city: "Pune" });
  });

  it("refuses bad input without calling Google", async () => {
    for (const bad of [
      { category: "nope", city: "Pune" },
      { category: "venue", city: "P" },
      {},
      null,
    ]) {
      expect(await discoverAction(bad)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
    }
    expect(discoverVendors).not.toHaveBeenCalled();
  });

  it("needs a signed-in member", async () => {
    requireMember.mockRejectedValue(new Error("no"));
    expect((await discoverAction({ category: "venue", city: "Pune" })).ok).toBe(false);
    expect(discoverVendors).not.toHaveBeenCalled();
  });
});
