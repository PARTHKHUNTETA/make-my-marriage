import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const consumeRateLimit = vi.hoisted(() => vi.fn());
const confirmEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ratelimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/ratelimit")>()),
  consumeRateLimit,
}));
vi.mock("@/modules/members/service", () => ({ confirmEmail }));

import { POST } from "./route";

const TOKEN = "abcdefghijklmnopqrstuv";
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  confirmEmail.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/auth/verify", () => {
  it("confirms the email for a valid token", async () => {
    const res = await post({ token: TOKEN });
    expect(res.status).toBe(200);
    expect(confirmEmail).toHaveBeenCalledWith(TOKEN);
  });

  it("answers an expired or used link with LINK_INVALID (404)", async () => {
    confirmEmail.mockRejectedValue(
      new AppError("LINK_INVALID", "This link has expired or has already been used."),
    );
    const res = await post({ token: TOKEN });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("LINK_INVALID");
  });

  it("only accepts POST (a plain GET from a mail scanner cannot use up the token)", async () => {
    const route = await import("./route");
    expect(Object.keys(route).filter((k) => ["GET", "POST", "PUT", "DELETE"].includes(k))).toEqual([
      "POST",
    ]);
  });

  it("rejects a junk token and limits attempts per IP", async () => {
    expect((await post({ token: "" })).status).toBe(400);
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Too many attempts."));
    expect((await post({ token: TOKEN })).status).toBe(429);
  });
});
