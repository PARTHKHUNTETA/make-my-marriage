import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const requireAdmin = vi.hoisted(() => vi.fn());
const deleteWedding = vi.hoisted(() => vi.fn());
const getWedding = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("./service", () => ({ deleteWedding }));
vi.mock("@/modules/wedding/service", () => ({ getWedding }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { deleteWeddingAction } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  requireAdmin.mockResolvedValue({ weddingId: "w1" });
  getWedding.mockResolvedValue({ website: { slug: "asha-dev" } });
  deleteWedding.mockResolvedValue(undefined);
});

describe("deleteWeddingAction", () => {
  it("deletes the signed-in admin's own wedding, whatever the input names", async () => {
    const r = await deleteWeddingAction({ confirmTitle: "Asha weds Dev", weddingId: "evil" });
    expect(r).toMatchObject({ ok: true });
    expect(deleteWedding).toHaveBeenCalledWith("w1", "Asha weds Dev");
    expect(revalidatePath).toHaveBeenCalledWith("/asha-dev");
  });

  it("is for admins only", async () => {
    requireAdmin.mockRejectedValue(new AppError("FORBIDDEN", "Only an admin can do this"));
    expect(await deleteWeddingAction({ confirmTitle: "x" })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(deleteWedding).not.toHaveBeenCalled();
  });

  it("refuses a missing title", async () => {
    for (const bad of [{}, { confirmTitle: "  " }, null]) {
      expect(await deleteWeddingAction(bad)).toMatchObject({ ok: false });
    }
    expect(deleteWedding).not.toHaveBeenCalled();
  });
});
