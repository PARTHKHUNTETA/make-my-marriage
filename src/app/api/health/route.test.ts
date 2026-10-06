import { afterEach, describe, expect, it, vi } from "vitest";

const pingDb = vi.hoisted(() => vi.fn<() => Promise<{ latencyMs: number }>>());
vi.mock("@/lib/db", () => ({ pingDb }));

import { GET } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
  pingDb.mockReset();
});

describe("GET /api/health", () => {
  it("reports the database as up with its latency", async () => {
    pingDb.mockResolvedValue({ latencyMs: 12 });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, data: { db: "up", latencyMs: 12 } });
  });

  it("returns the INTERNAL envelope when the database is down, without leaking the cause", async () => {
    const secret = "mongodb+srv://user:SuperSecretPassword@cluster.example.net";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = new Error(`connection to ${secret} refused`);
    cause.name = "MongoServerSelectionError";
    pingDb.mockRejectedValue(cause);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "Database unavailable" },
    });
    expect(JSON.stringify(body)).not.toContain("SuperSecretPassword");
    expect(log).toHaveBeenCalledWith("health check failed", "MongoServerSelectionError");
    expect(JSON.stringify(log.mock.calls)).not.toContain("SuperSecretPassword");
  });
});
