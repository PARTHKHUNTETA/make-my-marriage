import { beforeEach, describe, expect, it, vi } from "vitest";

const clearSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ clearSession }));

import { POST } from "./route";

beforeEach(() => {
  clearSession.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/auth/logout", () => {
  it("clears the session", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: {} });
    expect(clearSession).toHaveBeenCalledOnce();
  });

  it("reports INTERNAL if clearing fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    clearSession.mockRejectedValue(new Error("boom"));
    const res = await POST();
    expect(res.status).toBe(500);
    log.mockRestore();
  });
});
