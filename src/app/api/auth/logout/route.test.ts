import { beforeEach, describe, expect, it, vi } from "vitest";

const clearSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ clearSession }));

import { POST } from "./route";

const json = (body: unknown = {}) =>
  new Request("http://localhost/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  clearSession.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/auth/logout", () => {
  it("clears the session", async () => {
    const res = await POST(json());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: {} });
    expect(clearSession).toHaveBeenCalledOnce();
  });

  it("refuses a form post from another site and does not sign anyone out", async () => {
    const form = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "x=1",
    });
    const res = await POST(form);
    expect(res.status).toBe(400);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("reports INTERNAL if clearing fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    clearSession.mockRejectedValue(new Error("boom"));
    const res = await POST(json());
    expect(res.status).toBe(500);
    log.mockRestore();
  });
});
