import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const consumeRateLimit = vi.hoisted(() => vi.fn());
const resetPassword = vi.hoisted(() => vi.fn());
const setSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ratelimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/ratelimit")>()),
  consumeRateLimit,
}));
vi.mock("@/lib/session", () => ({ setSession }));
vi.mock("@/modules/members/service", () => ({ resetPassword }));

import { POST } from "./route";

const TOKEN = "abcdefghijklmnopqrstuv";
const post = (body: unknown, contentType = "application/json") =>
  POST(
    new Request("http://localhost/api/auth/reset", {
      method: "POST",
      headers: { "content-type": contentType },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  resetPassword.mockReset().mockResolvedValue(undefined);
  setSession.mockReset();
});

describe("POST /api/auth/reset", () => {
  it("sets the new password from the token", async () => {
    const res = await post({ token: TOKEN, password: "a-brand-new-password" });
    expect(res.status).toBe(200);
    expect(resetPassword).toHaveBeenCalledWith(TOKEN, "a-brand-new-password");
  });

  it("does not sign the person in (they sign in with the new password)", async () => {
    await post({ token: TOKEN, password: "a-brand-new-password" });
    expect(setSession).not.toHaveBeenCalled();
  });

  it("answers an expired or used link with LINK_INVALID (404)", async () => {
    resetPassword.mockRejectedValue(
      new AppError("LINK_INVALID", "This link has expired or has already been used."),
    );
    const res = await post({ token: TOKEN, password: "a-brand-new-password" });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("LINK_INVALID");
  });

  it("enforces the password policy on the server", async () => {
    const res = await post({ token: TOKEN, password: "short" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details.password).toBeDefined();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("rejects a junk token before touching the service", async () => {
    expect((await post({ token: "x", password: "a-brand-new-password" })).status).toBe(400);
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("limits guessing per IP", async () => {
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Too many attempts."));
    expect((await post({ token: TOKEN, password: "a-brand-new-password" })).status).toBe(429);
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("refuses non-JSON bodies", async () => {
    expect(
      (await post({ token: TOKEN, password: "a-brand-new-password" }, "text/plain")).status,
    ).toBe(400);
  });
});
