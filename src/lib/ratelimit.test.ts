import { beforeEach, describe, expect, it, vi } from "vitest";

const findOneAndUpdate = vi.hoisted(() => vi.fn());
const createIndex = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({
  getDb: async () => ({ collection: () => ({ findOneAndUpdate, createIndex }) }),
}));

async function load() {
  vi.resetModules();
  return import("./ratelimit");
}

beforeEach(() => {
  findOneAndUpdate.mockReset();
  createIndex.mockReset();
  createIndex.mockResolvedValue("expiresAt_1");
});

const rule = { limit: 3, windowSeconds: 900 };

describe("consumeRateLimit", () => {
  it("allows attempts up to the limit", async () => {
    const { consumeRateLimit } = await load();
    for (const count of [1, 2, 3]) {
      findOneAndUpdate.mockResolvedValueOnce({ _id: "x", count, expiresAt: new Date() });
      await expect(consumeRateLimit("login", "ip:abc", rule)).resolves.toBeUndefined();
    }
  });

  it("throws RATE_LIMITED past the limit", async () => {
    const { consumeRateLimit } = await load();
    findOneAndUpdate.mockResolvedValueOnce({ _id: "x", count: 4, expiresAt: new Date() });
    await expect(consumeRateLimit("login", "ip:abc", rule)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("fails closed if the counter cannot be read back", async () => {
    const { consumeRateLimit } = await load();
    findOneAndUpdate.mockResolvedValueOnce(null);
    await expect(consumeRateLimit("login", "ip:abc", rule)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("keys the counter by action and subject, and upserts atomically", async () => {
    const { consumeRateLimit } = await load();
    findOneAndUpdate.mockResolvedValueOnce({ _id: "x", count: 1, expiresAt: new Date() });
    await consumeRateLimit("login", "email:deadbeef", rule);
    const [filter, update, options] = findOneAndUpdate.mock.calls[0]!;
    expect(filter).toEqual({ _id: "login:email:deadbeef" });
    expect(Array.isArray(update)).toBe(true);
    expect(options).toMatchObject({ upsert: true, returnDocument: "after" });
  });

  it("counts a heavier call for what it costs", async () => {
    const { consumeRateLimit } = await load();
    findOneAndUpdate.mockResolvedValueOnce({ _id: "x", count: 50, expiresAt: new Date() });
    await consumeRateLimit("photo-files", "ip:a", { limit: 300, windowSeconds: 900, cost: 50 });
    const pipeline = JSON.stringify(findOneAndUpdate.mock.calls[0]![1]);
    expect(pipeline).toContain('{"$add":[{"$ifNull":["$count",0]},50]}');
    expect(pipeline).toContain(",50]");
  });

  it("creates the TTL index once per instance", async () => {
    const { consumeRateLimit } = await load();
    findOneAndUpdate.mockResolvedValue({ _id: "x", count: 1, expiresAt: new Date() });
    await consumeRateLimit("a", "s", rule);
    await consumeRateLimit("b", "s", rule);
    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(createIndex).toHaveBeenCalledWith({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  });
});

describe("subjectKey", () => {
  it("never contains the raw value and ignores case", async () => {
    const { subjectKey } = await load();
    const key = subjectKey("email", "Priya@Example.com");
    expect(key).toMatch(/^email:[0-9a-f]{32}$/);
    expect(key).not.toContain("priya");
    expect(key).toBe(subjectKey("email", "priya@example.com"));
    expect(key).not.toBe(subjectKey("email", "other@example.com"));
  });
});

describe("clientIp", () => {
  it("trusts x-real-ip, then the last forwarded address, never the first, then 'unknown'", async () => {
    const { clientIp } = await load();
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8", "x-forwarded-for": "9.9.9.9" }))).toBe(
      "5.6.7.8",
    );
    // the first entry is whatever the client claimed
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("on Vercel uses the platform's own header", async () => {
    vi.stubEnv("VERCEL", "1");
    const { clientIp } = await load();
    expect(
      clientIp(new Headers({ "x-vercel-forwarded-for": "4.4.4.4", "x-forwarded-for": "6.6.6.6" })),
    ).toBe("4.4.4.4");
    vi.unstubAllEnvs();
  });
});
