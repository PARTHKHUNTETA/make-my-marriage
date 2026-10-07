import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("server-only", () => ({}));
const requireMember = vi.hoisted(() => vi.fn());
const getEntryTokenForMember = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("@/modules/guests/service", () => ({ getEntryTokenForMember }));

import { GET } from "./route";

const G = "a".repeat(24);
const E = "b".repeat(24);
const call = (qs = "") =>
  GET(new Request(`http://localhost/api/guests/${G}/entry/${E}${qs}`), {
    params: Promise.resolve({ id: G, eventId: E }),
  });

beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1" });
  getEntryTokenForMember.mockReset().mockResolvedValue("ENTRYTOKEN0123456789abcd");
});

describe("GET /api/guests/[id]/entry/[eventId]", () => {
  it("returns the entry code as a PNG that is never cached", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-disposition")).toBeNull();
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("can be saved as a file", async () => {
    expect((await call("?download=1")).headers.get("content-disposition")).toContain(
      "entry-qr.png",
    );
  });

  it("looks the guest up in the signed-in member's own wedding, whatever the address says", async () => {
    await call();
    expect(getEntryTokenForMember).toHaveBeenCalledWith("w1", G, E);
  });

  it("is a 404 for a party that is not coming, or a guest who is not this wedding's", async () => {
    getEntryTokenForMember.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("json");
  });

  it("refuses someone who is not signed in, and looks nothing up", async () => {
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in to continue"));
    expect((await call()).status).toBe(401);
    expect(getEntryTokenForMember).not.toHaveBeenCalled();
  });
});
