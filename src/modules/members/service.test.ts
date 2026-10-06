import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/passwords";
import type { UserDoc } from "./repository";

const repo = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  insertUser: vi.fn(),
  findMembershipByUserId: vi.fn(),
  insertMembership: vi.fn(),
  findAuthState: vi.fn(),
  setVerifyToken: vi.fn(),
  consumeVerifyToken: vi.fn(),
  setResetToken: vi.fn(),
  consumeResetToken: vi.fn(),
}));
const queueEmail = vi.hoisted(() => vi.fn());
vi.mock("./repository", () => repo);
vi.mock("@/lib/email", () => ({ queueEmail }));
vi.mock("@/lib/app-url", () => ({ absoluteUrl: (path: string) => `http://app.test${path}` }));

import { MongoServerError } from "mongodb";
import { hashToken } from "@/lib/tokens";
import {
  addAdminMember,
  confirmEmail,
  getMembership,
  getProfile,
  logIn,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signUp,
} from "./service";

async function userDoc(password: string): Promise<UserDoc> {
  const now = new Date();
  return {
    _id: new ObjectId(),
    name: "Priya Sharma",
    email: "priya@example.com",
    passwordHash: await hashPassword(password),
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  repo.findUserByEmail.mockReset();
  repo.findUserById.mockReset();
  repo.insertUser.mockReset();
  repo.findMembershipByUserId.mockReset();
  repo.insertMembership.mockReset();
  for (const fn of [
    repo.findAuthState,
    repo.setVerifyToken,
    repo.consumeVerifyToken,
    repo.setResetToken,
    repo.consumeResetToken,
  ])
    fn.mockReset();
  queueEmail.mockReset().mockResolvedValue(undefined);
  repo.setVerifyToken.mockResolvedValue(undefined);
  repo.setResetToken.mockResolvedValue(undefined);
});

describe("signUp", () => {
  it("stores a hash, never the password, and returns only public fields", async () => {
    repo.insertUser.mockImplementation(async (input) => ({
      ...(await userDoc("ignored")),
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
    }));

    const user = await signUp({
      name: "Priya Sharma",
      email: "priya@example.com",
      password: "a-long-enough-password",
    });

    const stored = repo.insertUser.mock.calls[0]![0];
    expect(stored.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(JSON.stringify(stored)).not.toContain("a-long-enough-password");
    expect(Object.keys(user).sort()).toEqual(["email", "emailVerified", "id", "name"]);
    expect(user.email).toBe("priya@example.com");
  });

  it("raises EMAIL_IN_USE when the repository reports a duplicate", async () => {
    repo.insertUser.mockResolvedValue(null);
    await expect(
      signUp({ name: "P", email: "taken@example.com", password: "a-long-enough-password" }),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
  });
});

describe("logIn", () => {
  it("returns the public user for the right password", async () => {
    const doc = await userDoc("correct-password-1");
    repo.findUserByEmail.mockResolvedValue(doc);
    const user = await logIn({ email: doc.email, password: "correct-password-1", remember: false });
    expect(user).toEqual({
      id: doc._id.toHexString(),
      name: doc.name,
      email: doc.email,
      emailVerified: false,
    });
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const doc = await userDoc("correct-password-1");
    repo.findUserByEmail.mockResolvedValueOnce(doc);
    const wrongPassword = await logIn({
      email: doc.email,
      password: "wrong-password-1",
      remember: false,
    }).catch((e) => e);

    repo.findUserByEmail.mockResolvedValueOnce(null);
    const unknownEmail = await logIn({
      email: "ghost@example.com",
      password: "whatever-1234",
      remember: false,
    }).catch((e) => e);

    for (const err of [wrongPassword, unknownEmail]) {
      expect(err).toMatchObject({ code: "UNAUTHENTICATED" });
    }
    expect(wrongPassword.message).toBe(unknownEmail.message);
  });
});

describe("getProfile", () => {
  it("returns null for an unknown id", async () => {
    repo.findUserById.mockResolvedValue(null);
    expect(await getProfile("507f1f77bcf86cd799439011")).toBeNull();
  });

  it("returns public fields only", async () => {
    const doc = await userDoc("x-password-12");
    repo.findUserById.mockResolvedValue(doc);
    expect(Object.keys((await getProfile(doc._id.toHexString()))!).sort()).toEqual([
      "email",
      "emailVerified",
      "id",
      "name",
    ]);
  });
});

describe("getMembership", () => {
  it("returns the wedding and role as plain strings", async () => {
    const weddingId = new ObjectId();
    const _id = new ObjectId();
    repo.findMembershipByUserId.mockResolvedValue({ _id, weddingId, role: "admin" });
    expect(await getMembership("u1")).toEqual({
      weddingId: weddingId.toHexString(),
      memberId: _id.toHexString(),
      role: "admin",
    });
  });

  it("is null before first-time setup", async () => {
    repo.findMembershipByUserId.mockResolvedValue(null);
    expect(await getMembership("u1")).toBeNull();
  });
});

describe("addAdminMember", () => {
  const session = { id: "s" };

  it("adds the creator as admin inside the caller's transaction", async () => {
    repo.insertMembership.mockResolvedValue(undefined);
    await addAdminMember({ userId: "u1", weddingId: "w1" }, { session: session as never });
    expect(repo.insertMembership).toHaveBeenCalledWith(
      { userId: "u1", weddingId: "w1", role: "admin" },
      { session },
    );
  });

  it("reports an existing membership as FORBIDDEN (one wedding per account)", async () => {
    repo.insertMembership.mockRejectedValue(
      new MongoServerError({ code: 11000, message: "E11000 duplicate key" }),
    );
    await expect(addAdminMember({ userId: "u1", weddingId: "w1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets other failures through untouched", async () => {
    repo.insertMembership.mockRejectedValue(new Error("network down"));
    await expect(addAdminMember({ userId: "u1", weddingId: "w1" })).rejects.toThrow("network down");
  });
});

// ---- email verification and password reset ----

const tokenIn = (url: string) => url.split("/").pop()!;

describe("email verification", () => {
  it("sign-up sends a link whose token is stored only as a hash", async () => {
    repo.insertUser.mockImplementation(async (input) => ({
      ...(await userDoc("x")),
      name: input.name,
      email: input.email,
    }));
    await signUp({ name: "Priya", email: "priya@example.com", password: "a-long-enough-password" });

    const queued = queueEmail.mock.calls[0]![0];
    expect(queued).toMatchObject({ type: "verify", toEmail: "priya@example.com" });
    const token = tokenIn(queued.payload.url);
    expect(queued.payload.url).toBe(`http://app.test/verify-email/${token}`);
    const [, storedHash, expiresAt] = repo.setVerifyToken.mock.calls[0]!;
    expect(storedHash).toBe(hashToken(token));
    expect(storedHash).not.toContain(token);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(23 * 3600 * 1000);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(24 * 3600 * 1000);
  });

  it("still creates the account if the email cannot be queued", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    repo.insertUser.mockImplementation(async (input) => ({
      ...(await userDoc("x")),
      email: input.email,
    }));
    queueEmail.mockRejectedValue(new Error("queue down"));
    await expect(
      signUp({ name: "P", email: "p@example.com", password: "a-long-enough-password" }),
    ).resolves.toMatchObject({ email: "p@example.com" });
    log.mockRestore();
  });

  it("confirming looks the token up by its hash", async () => {
    repo.consumeVerifyToken.mockResolvedValue(await userDoc("x"));
    await confirmEmail("plain-token-value-123");
    expect(repo.consumeVerifyToken.mock.calls[0]![0]).toBe(hashToken("plain-token-value-123"));
  });

  it("an unknown, expired or used token is LINK_INVALID", async () => {
    repo.consumeVerifyToken.mockResolvedValue(null);
    await expect(confirmEmail("plain-token-value-123")).rejects.toMatchObject({
      code: "LINK_INVALID",
    });
  });

  it("resending issues a fresh link, unless the email is already confirmed", async () => {
    const doc = await userDoc("x");
    repo.findUserById.mockResolvedValue(doc);
    await resendVerification(doc._id.toHexString());
    expect(queueEmail).toHaveBeenCalledOnce();

    queueEmail.mockClear();
    repo.findUserById.mockResolvedValue({ ...doc, emailVerified: true });
    await resendVerification(doc._id.toHexString());
    expect(queueEmail).not.toHaveBeenCalled();
  });
});

describe("password reset", () => {
  it("answers the same, and does nothing, for an address with no account", async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    await expect(requestPasswordReset("ghost@example.com")).resolves.toBeUndefined();
    expect(repo.setResetToken).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
  });

  it("sends a one-hour link for a real account, with the token stored hashed", async () => {
    const doc = await userDoc("x");
    repo.findUserByEmail.mockResolvedValue(doc);
    await requestPasswordReset(doc.email);

    const queued = queueEmail.mock.calls[0]![0];
    expect(queued).toMatchObject({ type: "reset", toEmail: doc.email });
    const token = tokenIn(queued.payload.url);
    expect(queued.payload.url).toBe(`http://app.test/reset-password/${token}`);
    const [userId, storedHash, expiresAt] = repo.setResetToken.mock.calls[0]!;
    expect(userId).toBe(doc._id.toHexString());
    expect(storedHash).toBe(hashToken(token));
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(3600 * 1000);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(3590 * 1000);
  });

  it("each request makes a new token, so an older link stops working", async () => {
    repo.findUserByEmail.mockResolvedValue(await userDoc("x"));
    await requestPasswordReset("priya@example.com");
    await requestPasswordReset("priya@example.com");
    expect(repo.setResetToken.mock.calls[0]![1]).not.toBe(repo.setResetToken.mock.calls[1]![1]);
  });

  it("stores the new password as an Argon2id hash and uses the token by its hash", async () => {
    repo.consumeResetToken.mockResolvedValue(await userDoc("x"));
    await resetPassword("plain-token-value-123", "brand-new-password-1");
    const [hashArg, , passwordHash] = repo.consumeResetToken.mock.calls[0]!;
    expect(hashArg).toBe(hashToken("plain-token-value-123"));
    expect(passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(passwordHash).not.toContain("brand-new-password-1");
  });

  it("an unknown, expired or used token is LINK_INVALID", async () => {
    repo.consumeResetToken.mockResolvedValue(null);
    await expect(
      resetPassword("plain-token-value-123", "brand-new-password-1"),
    ).rejects.toMatchObject({ code: "LINK_INVALID" });
  });
});
