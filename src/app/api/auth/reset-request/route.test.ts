import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const consumeRateLimit = vi.hoisted(() => vi.fn());
const requestPasswordReset = vi.hoisted(() => vi.fn());
const afterTasks = vi.hoisted(() => [] as Array<() => Promise<void>>);
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => afterTasks.push(task),
}));
vi.mock("@/lib/ratelimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/ratelimit")>()),
  consumeRateLimit,
}));
vi.mock("@/modules/members/service", () => ({ requestPasswordReset }));

import { POST } from "./route";

const post = (body: unknown, contentType = "application/json") =>
  POST(
    new Request("http://localhost/api/auth/reset-request", {
      method: "POST",
      headers: { "content-type": contentType, "x-forwarded-for": "9.9.9.9" },
      body: JSON.stringify(body),
    }),
  );
const runAfter = async () => {
  for (const task of afterTasks.splice(0)) await task();
};

beforeEach(() => {
  afterTasks.length = 0;
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  requestPasswordReset.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/auth/reset-request", () => {
  it("answers 200 with an empty body", async () => {
    const res = await post({ email: "priya@example.com" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: {} });
  });

  it("does the lookup and sends the email only after responding", async () => {
    await post({ email: "Priya@Example.com" });
    expect(requestPasswordReset).not.toHaveBeenCalled(); // not before the response
    await runAfter();
    expect(requestPasswordReset).toHaveBeenCalledWith("priya@example.com");
  });

  it("gives an identical response for an address with an account and one without", async () => {
    const [known, unknown] = [
      await post({ email: "known@example.com" }),
      await post({ email: "ghost@example.com" }),
    ];
    expect(known.status).toBe(unknown.status);
    expect(await known.json()).toEqual(await unknown.json());
    requestPasswordReset.mockImplementation(async (email: string) => {
      if (email === "ghost@example.com") return;
    });
    await runAfter(); // nothing the service does is visible to the caller
  });

  it("does not report a failure if sending the email fails afterwards", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    requestPasswordReset.mockRejectedValue(new Error("provider down"));
    expect((await post({ email: "priya@example.com" })).status).toBe(200);
    await expect(runAfter()).resolves.toBeUndefined();
    log.mockRestore();
  });

  it("limits requests per IP and per email, hashing both", async () => {
    await post({ email: "priya@example.com" });
    expect(consumeRateLimit).toHaveBeenCalledTimes(2);
    const [ip, email] = consumeRateLimit.mock.calls;
    expect(ip![1]).toMatch(/^ip:/);
    expect(email![1]).toMatch(/^email:/);
    expect(email![2]).toMatchObject({ limit: 5, windowSeconds: 3600 });
    expect(JSON.stringify(consumeRateLimit.mock.calls)).not.toContain("priya@example.com");
  });

  it("returns 429 when limited and sends nothing", async () => {
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Too many attempts."));
    const res = await post({ email: "priya@example.com" });
    expect(res.status).toBe(429);
    await runAfter();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("rejects a malformed email and a non-JSON body", async () => {
    expect((await post({ email: "nope" })).status).toBe(400);
    expect((await post({ email: "a@b.co" }, "text/plain")).status).toBe(400);
    await runAfter();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
});
