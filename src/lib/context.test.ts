import { beforeEach, describe, expect, it, vi } from "vitest";

const readSession = vi.hoisted(() => vi.fn());
const getMembership = vi.hoisted(() => vi.fn());
const getAuthState = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ readSession }));
vi.mock("@/modules/members/service", () => ({ getMembership, getAuthState }));

import { resolveContext } from "./context";

const NOW = Math.floor(Date.now() / 1000);

beforeEach(() => {
  readSession.mockReset();
  getMembership.mockReset().mockResolvedValue(null);
  getAuthState.mockReset().mockResolvedValue({ emailVerified: true });
});

describe("resolveContext", () => {
  it("is anonymous without a valid session, and never touches the database", async () => {
    readSession.mockResolvedValue(null);
    expect(await resolveContext()).toEqual({ kind: "anonymous" });
    expect(getMembership).not.toHaveBeenCalled();
    expect(getAuthState).not.toHaveBeenCalled();
  });

  it("is a signed-in user (no wedding yet) when the account has no membership", async () => {
    readSession.mockResolvedValue({ userId: "u1", issuedAt: NOW });
    expect(await resolveContext()).toEqual({ kind: "user", userId: "u1" });
  });

  it("is a member, with wedding and role, once the account belongs to a wedding", async () => {
    readSession.mockResolvedValue({ userId: "u1", issuedAt: NOW });
    getMembership.mockResolvedValue({ weddingId: "w1", role: "manager" });
    expect(await resolveContext()).toEqual({
      kind: "member",
      userId: "u1",
      weddingId: "w1",
      role: "manager",
    });
  });

  it("takes the wedding and role from the database, so a removed member loses access at once", async () => {
    readSession.mockResolvedValue({ userId: "u1", issuedAt: NOW });
    getMembership
      .mockResolvedValueOnce({ weddingId: "w1", role: "admin" })
      .mockResolvedValueOnce(null);
    expect((await resolveContext()).kind).toBe("member");
    expect((await resolveContext()).kind).toBe("user");
  });

  it("is anonymous when the account no longer exists, even with a valid cookie", async () => {
    readSession.mockResolvedValue({ userId: "gone", issuedAt: NOW });
    getAuthState.mockResolvedValue(null);
    getMembership.mockResolvedValue({ weddingId: "w1", role: "admin" });
    expect(await resolveContext()).toEqual({ kind: "anonymous" });
  });
});

describe("resolveContext after a password reset", () => {
  const resetAt = new Date((NOW - 100) * 1000);

  it("rejects a session that began before the reset", async () => {
    readSession.mockResolvedValue({ userId: "u1", issuedAt: NOW - 3600 });
    getAuthState.mockResolvedValue({ emailVerified: true, sessionsValidAfter: resetAt });
    expect(await resolveContext()).toEqual({ kind: "anonymous" });
  });

  it("accepts a session created after the reset", async () => {
    readSession.mockResolvedValue({ userId: "u1", issuedAt: NOW - 50 });
    getAuthState.mockResolvedValue({ emailVerified: true, sessionsValidAfter: resetAt });
    expect((await resolveContext()).kind).toBe("user");
  });

  it("accepts a session created in the same second as the reset (second precision)", async () => {
    readSession.mockResolvedValue({ userId: "u1", issuedAt: NOW - 100 });
    getAuthState.mockResolvedValue({
      emailVerified: true,
      sessionsValidAfter: new Date((NOW - 100) * 1000 + 700),
    });
    expect((await resolveContext()).kind).toBe("user");
  });

  it("is unaffected when the password was never reset", async () => {
    readSession.mockResolvedValue({ userId: "u1", issuedAt: NOW - 86400 * 20 });
    expect((await resolveContext()).kind).toBe("user");
  });
});
