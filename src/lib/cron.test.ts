import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = "cron-secret-cron-secret-cron-secret-1";

async function load(secret: string | undefined = SECRET) {
  vi.resetModules();
  if (secret !== undefined) vi.stubEnv("CRON_SECRET", secret);
  return (await import("./cron")).isCronAuthorized;
}
const req = (authorization?: string) =>
  new Request("http://localhost/api/cron/x", { headers: authorization ? { authorization } : {} });

afterEach(() => vi.unstubAllEnvs());

describe("isCronAuthorized", () => {
  it("accepts the right bearer token", async () => {
    expect((await load())(req(`Bearer ${SECRET}`))).toBe(true);
  });

  it.each([
    ["no header", undefined],
    ["an empty bearer", "Bearer "],
    ["the wrong secret", "Bearer wrong-secret-wrong-secret-wrong-secret"],
    ["the secret without 'Bearer'", SECRET],
    ["a prefix of the secret", `Bearer ${SECRET.slice(0, -1)}`],
    ["the secret plus extra", `Bearer ${SECRET}x`],
    ["basic auth", `Basic ${SECRET}`],
  ])("rejects %s", async (_label, header) => {
    expect((await load())(req(header))).toBe(false);
  });

  it("fails closed when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await load(undefined))(req("Bearer "))).toBe(false);
  });

  it("fails closed when the secret is too short to be safe", async () => {
    expect((await load("short"))(req("Bearer short"))).toBe(false);
  });
});
