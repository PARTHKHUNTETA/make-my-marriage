import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const requireUser = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const resendVerification = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireUser }));
vi.mock("@/lib/ratelimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/ratelimit")>()),
  consumeRateLimit,
}));
vi.mock("@/modules/members/service", () => ({ resendVerification }));

import { POST } from "./route";

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ kind: "user", userId: "u1" });
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  resendVerification.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/auth/resend-verification", () => {
  it("sends a new link to the signed-in account", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(resendVerification).toHaveBeenCalledWith("u1");
  });

  it("requires sign-in", async () => {
    requireUser.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in to continue"));
    expect((await POST()).status).toBe(401);
    expect(resendVerification).not.toHaveBeenCalled();
  });

  it("allows only 3 an hour per account, so it cannot flood an inbox", async () => {
    await POST();
    expect(consumeRateLimit.mock.calls[0]![2]).toEqual({ limit: 3, windowSeconds: 3600 });
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Too many attempts."));
    expect((await POST()).status).toBe(429);
    expect(resendVerification).toHaveBeenCalledTimes(1);
  });
});
