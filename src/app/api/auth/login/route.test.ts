import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const consumeRateLimit = vi.hoisted(() => vi.fn());
const setSession = vi.hoisted(() => vi.fn());
const logIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ratelimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/ratelimit")>()),
  consumeRateLimit,
}));
vi.mock("@/lib/session", () => ({ setSession }));
vi.mock("@/modules/members/service", () => ({ logIn }));

import { POST } from "./route";

const user = { id: "u1", name: "Priya", email: "priya@example.com" };

function post(
  body: unknown,
  headers: Record<string, string> = { "content-type": "application/json" },
) {
  return POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "x-forwarded-for": "9.9.9.9", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  setSession.mockReset().mockResolvedValue(undefined);
  logIn.mockReset();
});

describe("POST /api/auth/login", () => {
  it("signs in and starts a session", async () => {
    logIn.mockResolvedValue(user);
    const res = await post({ email: "Priya@Example.com", password: "pw", remember: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { user, next: "/dashboard" } });
    expect(logIn).toHaveBeenCalledWith({
      email: "priya@example.com",
      password: "pw",
      remember: true,
    });
    expect(setSession).toHaveBeenCalledWith("u1", true);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("uses a browser-session cookie unless remember is ticked", async () => {
    logIn.mockResolvedValue(user);
    await post({ email: "priya@example.com", password: "pw" });
    expect(setSession).toHaveBeenCalledWith("u1", false);
  });

  it("answers wrong credentials with 401 and no session", async () => {
    logIn.mockRejectedValue(new AppError("UNAUTHENTICATED", "Incorrect email or password."));
    const res = await post({ email: "priya@example.com", password: "bad" });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toEqual({
      code: "UNAUTHENTICATED",
      message: "Incorrect email or password.",
    });
    expect(setSession).not.toHaveBeenCalled();
  });

  it("rate limits per IP first and per email second", async () => {
    logIn.mockResolvedValue(user);
    await post({ email: "priya@example.com", password: "pw" });
    expect(consumeRateLimit).toHaveBeenCalledTimes(2);
    const [ipCall, emailCall] = consumeRateLimit.mock.calls;
    expect(ipCall![1]).toMatch(/^ip:/);
    expect(emailCall![1]).toMatch(/^email:/);
    expect(JSON.stringify(consumeRateLimit.mock.calls)).not.toContain("priya@example.com");
    expect(JSON.stringify(consumeRateLimit.mock.calls)).not.toContain("9.9.9.9");
  });

  it("returns 429 when limited and never checks the password", async () => {
    consumeRateLimit.mockRejectedValueOnce(new AppError("RATE_LIMITED", "Too many attempts."));
    const res = await post({ email: "priya@example.com", password: "pw" });
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    expect(logIn).not.toHaveBeenCalled();
  });

  it("counts attempts even when the body is invalid (the IP limit runs before parsing)", async () => {
    const res = await post({ email: "nope" });
    expect(res.status).toBe(400);
    expect(consumeRateLimit).toHaveBeenCalledTimes(1);
  });

  it("returns field errors for invalid input", async () => {
    const res = await post({ email: "not-an-email", password: "" });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(body.error.details).sort()).toEqual(["email", "password"]);
    expect(logIn).not.toHaveBeenCalled();
  });

  it("refuses non-JSON content types (login CSRF)", async () => {
    const res = await post("email=a%40b.co&password=x", {
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(res.status).toBe(400);
    expect(logIn).not.toHaveBeenCalled();
  });

  it("refuses malformed JSON", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
  });

  it("hides unexpected failures behind INTERNAL", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    logIn.mockRejectedValue(new Error("connection to mongodb+srv://user:SuperSecret@host failed"));
    const res = await post({ email: "priya@example.com", password: "pw" });
    const text = JSON.stringify(await res.json());
    expect(res.status).toBe(500);
    expect(text).toContain("INTERNAL");
    expect(text).not.toContain("SuperSecret");
    expect(JSON.stringify(log.mock.calls)).not.toContain("SuperSecret");
    log.mockRestore();
  });
});
