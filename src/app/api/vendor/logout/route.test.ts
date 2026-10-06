import { beforeEach, describe, expect, it, vi } from "vitest";

const clearVendorSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ clearVendorSession }));

import { POST } from "./route";

const request = (type: string, body: string) =>
  new Request("http://localhost/api/vendor/logout", {
    method: "POST",
    headers: { "Content-Type": type },
    body,
  });

beforeEach(() => {
  clearVendorSession.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/vendor/logout", () => {
  it("ends the vendor session", async () => {
    const res = await POST(request("application/json", "{}"));
    expect(res.status).toBe(200);
    expect(clearVendorSession).toHaveBeenCalledOnce();
  });

  it("refuses a form post from another site and does not sign anyone out", async () => {
    const res = await POST(request("application/x-www-form-urlencoded", "x=1"));
    expect(res.status).toBe(400);
    expect(clearVendorSession).not.toHaveBeenCalled();
  });
});
