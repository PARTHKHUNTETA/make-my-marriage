import { SignJWT, decodeJwt } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-test-secret-test-secret-123";

// Each test gets a fresh module so the cached environment never leaks between secrets.
async function load(secret = SECRET) {
  vi.resetModules();
  vi.stubEnv("SESSION_SECRET", secret);
  return import("./session");
}

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("session tokens", () => {
  it("round-trips the user id", async () => {
    const s = await load();
    const token = await s.signSessionToken("user-123", false);
    const session = await s.verifySessionToken(token);
    expect(session?.userId).toBe("user-123");
    // Issued "now", give or take the second that may tick over between signing and checking.
    expect(Math.abs(session!.issuedAt - Math.floor(Date.now() / 1000))).toBeLessThanOrEqual(1);
  });

  it("issues a different token on every sign-in (rotation)", async () => {
    const s = await load();
    const [a, b] = await Promise.all([
      s.signSessionToken("u", true),
      s.signSessionToken("u", true),
    ]);
    expect(a).not.toBe(b);
    expect(decodeJwt(a).jti).not.toBe(decodeJwt(b).jti);
  });

  it("lasts 30 days when remembered and 1 day otherwise", async () => {
    const s = await load();
    const remembered = decodeJwt(await s.signSessionToken("u", true));
    const sessionOnly = decodeJwt(await s.signSessionToken("u", false));
    expect(remembered.exp! - remembered.iat!).toBe(30 * 24 * 3600);
    expect(sessionOnly.exp! - sessionOnly.iat!).toBe(24 * 3600);
  });

  it("rejects a token once it has expired", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const s = await load();
    const day = await s.signSessionToken("u", false);
    const month = await s.signSessionToken("u", true);
    vi.setSystemTime(Date.now() + 25 * 3600 * 1000);
    expect(await s.verifySessionToken(day)).toBeNull();
    expect(await s.verifySessionToken(month)).toMatchObject({ userId: "u" });
    vi.setSystemTime(Date.now() + 31 * 24 * 3600 * 1000);
    expect(await s.verifySessionToken(month)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const s = await load();
    const token = await s.signSessionToken("victim", false);
    const [h, p, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...decodeJwt(token), sub: "attacker" })).toString(
      "base64url",
    );
    expect(await s.verifySessionToken(`${h}.${forged}.${sig}`)).toBeNull();
    expect(await s.verifySessionToken(`${h}.${p}.${sig!.slice(0, -2)}xx`)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const other = await load("another-secret-another-secret-another-1");
    const token = await other.signSessionToken("u", false);
    const s = await load();
    expect(await s.verifySessionToken(token)).toBeNull();
  });

  it("rejects an unsigned token (alg none)", async () => {
    const s = await load();
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const claims = {
      sub: "u",
      iss: "makemymarriage",
      aud: "member",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    expect(
      await s.verifySessionToken(`${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.`),
    ).toBeNull();
  });

  it("rejects a token for another audience even with the right secret", async () => {
    const s = await load();
    const vendorToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("v1")
      .setIssuer("makemymarriage")
      .setAudience("vendor")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET));
    expect(await s.verifySessionToken(vendorToken)).toBeNull();
  });

  it("returns null for garbage", async () => {
    const s = await load();
    expect(await s.verifySessionToken("")).toBeNull();
    expect(await s.verifySessionToken("not.a.jwt")).toBeNull();
  });

  it("refuses to sign without a long enough secret", async () => {
    const s = await load("too-short");
    await expect(s.signSessionToken("u", false)).rejects.toThrow(/SESSION_SECRET/);
  });
});

describe("vendor sessions are a separate space", () => {
  it("a vendor token is not a member session, and a member token is not a vendor session", async () => {
    const s = await load();
    const vendorToken = await s.signSessionToken("vendor-1", false, "vendor");
    const memberToken = await s.signSessionToken("user-1", false);
    expect(await s.verifySessionToken(vendorToken, "vendor")).toMatchObject({ userId: "vendor-1" });
    expect(await s.verifySessionToken(vendorToken)).toBeNull();
    expect(await s.verifySessionToken(memberToken, "vendor")).toBeNull();
    expect(await s.verifySessionToken(memberToken)).toMatchObject({ userId: "user-1" });
  });

  it("uses its own cookie name", async () => {
    const s = await load();
    expect(s.VENDOR_SESSION_COOKIE).not.toBe(s.SESSION_COOKIE);
  });
});

describe("session ids", () => {
  it("carries a per-token id and expiry, different for every login", async () => {
    const s = await load();
    const a = await s.verifySessionToken(await s.signSessionToken("u1", true));
    const b = await s.verifySessionToken(await s.signSessionToken("u1", true));
    expect(a?.id).toBeTruthy();
    expect(a?.id).not.toBe(b?.id);
    const days = (a!.expiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });
});
