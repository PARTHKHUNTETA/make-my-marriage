import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const consumeRateLimit = vi.hoisted(() => vi.fn());
const setSession = vi.hoisted(() => vi.fn());
const signUp = vi.hoisted(() => vi.fn());
const signUpWithInvite = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ratelimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/ratelimit")>()),
  consumeRateLimit,
}));
vi.mock("@/lib/session", () => ({ setSession }));
vi.mock("@/modules/members/service", () => ({ signUp, signUpWithInvite }));

import { POST } from "./route";

const user = { id: "u1", name: "Priya Sharma", email: "priya@example.com" };
const valid = {
  name: "Priya Sharma",
  email: "priya@example.com",
  password: "a-long-enough-password",
};

function post(
  body: unknown,
  headers: Record<string, string> = { "content-type": "application/json" },
) {
  return POST(
    new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "x-forwarded-for": "9.9.9.9", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  setSession.mockReset().mockResolvedValue(undefined);
  signUp.mockReset();
  signUpWithInvite.mockReset();
});

describe("POST /api/auth/signup", () => {
  it("creates the account, signs in and answers 201", async () => {
    signUp.mockResolvedValue(user);
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, data: { user, next: "/setup" } });
    expect(setSession).toHaveBeenCalledWith("u1", true);
  });

  it("answers EMAIL_IN_USE with 409 and no session", async () => {
    signUp.mockRejectedValue(
      new AppError("EMAIL_IN_USE", "An account with this email already exists."),
    );
    const res = await post(valid);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EMAIL_IN_USE");
    expect(setSession).not.toHaveBeenCalled();
  });

  it("enforces the password policy on the server", async () => {
    const res = await post({ ...valid, password: "short" });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.details.password).toBeDefined();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("limits sign-ups per IP before doing any work", async () => {
    consumeRateLimit.mockRejectedValueOnce(new AppError("RATE_LIMITED", "Too many attempts."));
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(signUp).not.toHaveBeenCalled();
    expect(consumeRateLimit.mock.calls[0]![0]).toBe("signup");
  });

  it("refuses non-JSON content types", async () => {
    const res = await post(valid, { "content-type": "text/plain" });
    expect(res.status).toBe(400);
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/signup from an invitation", () => {
  const token = "abcdefghijklmnopqrstuv";
  const invited = { name: "Rahul Sharma", password: "a-long-enough-password", token };

  it("joins the wedding through the invitation and goes straight to the dashboard", async () => {
    signUpWithInvite.mockResolvedValue({ ...user, email: "rahul@example.com" });
    const res = await post(invited);
    expect(res.status).toBe(201);
    expect((await res.json()).data.next).toBe("/dashboard");
    expect(signUpWithInvite).toHaveBeenCalledWith(invited);
    expect(signUp).not.toHaveBeenCalled();
    expect(setSession).toHaveBeenCalledWith("u1", true);
  });

  it("ignores any email in the body: the invitation decides the address", async () => {
    signUpWithInvite.mockResolvedValue(user);
    await post({ ...invited, email: "attacker@example.com" });
    expect(JSON.stringify(signUpWithInvite.mock.calls[0])).not.toContain("attacker@example.com");
  });

  it("answers an expired or cancelled invitation with LINK_INVALID (404) and no session", async () => {
    signUpWithInvite.mockRejectedValue(
      new AppError("LINK_INVALID", "This invitation has expired or is no longer valid."),
    );
    const res = await post(invited);
    expect(res.status).toBe(404);
    expect(setSession).not.toHaveBeenCalled();
  });

  it("tells an existing account to sign in (EMAIL_IN_USE, 409)", async () => {
    signUpWithInvite.mockRejectedValue(
      new AppError("EMAIL_IN_USE", "An account already exists for this email."),
    );
    expect((await post(invited)).status).toBe(409);
  });

  it("applies the same password policy", async () => {
    const res = await post({ ...invited, password: "short" });
    expect(res.status).toBe(400);
    expect(signUpWithInvite).not.toHaveBeenCalled();
  });

  it("a plain sign-up now continues to first-time setup", async () => {
    signUp.mockResolvedValue(user);
    expect((await (await post(valid)).json()).data.next).toBe("/setup");
  });
});

describe("sign-up rate limits", () => {
  const token = "abcdefghijklmnopqrstuv";
  const invited = { name: "Rahul Sharma", password: "a-long-enough-password", token };

  it("gives open sign-ups 5 an hour per IP", async () => {
    signUp.mockResolvedValue(user);
    await post(valid);
    expect(consumeRateLimit.mock.calls[0]![0]).toBe("signup");
    expect(consumeRateLimit.mock.calls[0]![2]).toEqual({ limit: 5, windowSeconds: 3600 });
  });

  it("gives sign-ups from an invitation their own, larger allowance", async () => {
    signUpWithInvite.mockResolvedValue(user);
    await post(invited);
    expect(consumeRateLimit.mock.calls[0]![0]).toBe("signup-invite");
    expect(consumeRateLimit.mock.calls[0]![2]).toEqual({ limit: 30, windowSeconds: 3600 });
  });

  it("does not spend the budget on a malformed body", async () => {
    const bad = await POST(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{nope",
      }),
    );
    expect(bad.status).toBe(400);
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });

  it("blocks an invitation sign-up once its allowance is used", async () => {
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Too many attempts."));
    expect((await post(invited)).status).toBe(429);
    expect(signUpWithInvite).not.toHaveBeenCalled();
  });
});
