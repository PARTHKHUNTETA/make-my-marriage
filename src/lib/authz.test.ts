import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "./context";

const resolveContext = vi.hoisted(() => vi.fn<() => Promise<Context>>());
const resolveVendorContext = vi.hoisted(() => vi.fn());
const getProfile = vi.hoisted(() => vi.fn());
const getStaffEmails = vi.hoisted(() => vi.fn());
vi.mock("@/lib/context", () => ({ resolveContext, resolveVendorContext }));
vi.mock("@/modules/members/service", () => ({ getProfile }));
vi.mock("@/lib/env", () => ({ getStaffEmails }));

import {
  canManageMembers,
  requireAdmin,
  requireMember,
  requireStaff,
  requireUser,
  requireVendor,
} from "./authz";

const admin: Context = {
  kind: "member",
  userId: "u1",
  weddingId: "w1",
  memberId: "m1",
  role: "admin",
};
const manager: Context = {
  kind: "member",
  userId: "u2",
  weddingId: "w1",
  memberId: "m1",
  role: "manager",
};
const vendor: Context = { kind: "vendor", vendorAccountId: "v1" };
const guest: Context = { kind: "guest", weddingId: "w1", guestId: "g1" };
const user: Context = { kind: "user", userId: "u3" };
const anonymous: Context = { kind: "anonymous" };

beforeEach(() => {
  resolveContext.mockReset();
});

describe("canManageMembers", () => {
  it("is true only for an admin member", () => {
    expect(canManageMembers(admin)).toBe(true);
    expect(canManageMembers(manager)).toBe(false);
    expect(canManageMembers(vendor)).toBe(false);
    expect(canManageMembers(user)).toBe(false);
    expect(canManageMembers(guest)).toBe(false);
    expect(canManageMembers(anonymous)).toBe(false);
  });
});

describe("requireMember", () => {
  it("returns the context for admins and managers", async () => {
    resolveContext.mockResolvedValue(admin);
    await expect(requireMember()).resolves.toBe(admin);
    resolveContext.mockResolvedValue(manager);
    await expect(requireMember()).resolves.toBe(manager);
  });

  it.each([vendor, guest, anonymous])("rejects a %o caller as UNAUTHENTICATED", async (ctx) => {
    resolveContext.mockResolvedValue(ctx);
    await expect(requireMember()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("tells a signed-in account without a wedding to set one up (FORBIDDEN)", async () => {
    resolveContext.mockResolvedValue(user);
    await expect(requireMember()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("requireUser", () => {
  it("allows a signed-in account with or without a wedding", async () => {
    resolveContext.mockResolvedValue(user);
    await expect(requireUser()).resolves.toBe(user);
    resolveContext.mockResolvedValue(manager);
    await expect(requireUser()).resolves.toBe(manager);
  });

  it.each([vendor, guest, anonymous])("rejects a %o caller as UNAUTHENTICATED", async (ctx) => {
    resolveContext.mockResolvedValue(ctx);
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("requireAdmin", () => {
  it("allows an admin", async () => {
    resolveContext.mockResolvedValue(admin);
    await expect(requireAdmin()).resolves.toBe(admin);
  });

  it("forbids a manager (authenticated but not allowed)", async () => {
    resolveContext.mockResolvedValue(manager);
    await expect(requireAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects non-members as UNAUTHENTICATED", async () => {
    resolveContext.mockResolvedValue(anonymous);
    await expect(requireAdmin()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("does not let an account without a wedding act as admin", async () => {
    resolveContext.mockResolvedValue(user);
    await expect(requireAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("requireVendor", () => {
  it("allows a signed-in vendor", async () => {
    resolveVendorContext.mockResolvedValue(vendor);
    await expect(requireVendor()).resolves.toBe(vendor);
  });

  it("refuses when there is no vendor session, even if a wedding member is signed in", async () => {
    resolveVendorContext.mockResolvedValue(null);
    resolveContext.mockResolvedValue(admin);
    await expect(requireVendor()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("requireStaff", () => {
  const profile = (over = {}) => ({
    id: "u1",
    name: "S",
    email: "Team@Example.com",
    emailVerified: true,
    ...over,
  });

  it("allows a verified account on the staff list, whatever the capitalisation", async () => {
    resolveContext.mockResolvedValue(admin);
    getProfile.mockResolvedValue(profile());
    getStaffEmails.mockReturnValue(["team@example.com"]);
    await expect(requireStaff()).resolves.toEqual({ userId: "u1", email: "Team@Example.com" });
  });

  it("refuses an account that is not on the list, an unverified one, and an empty list", async () => {
    resolveContext.mockResolvedValue(admin);
    getProfile.mockResolvedValue(profile({ email: "other@example.com" }));
    getStaffEmails.mockReturnValue(["team@example.com"]);
    await expect(requireStaff()).rejects.toMatchObject({ code: "FORBIDDEN" });
    getProfile.mockResolvedValue(profile({ emailVerified: false }));
    await expect(requireStaff()).rejects.toMatchObject({ code: "FORBIDDEN" });
    getProfile.mockResolvedValue(profile());
    getStaffEmails.mockReturnValue([]);
    await expect(requireStaff()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a signed-out visitor and a vendor session", async () => {
    resolveContext.mockResolvedValue({ kind: "anonymous" });
    await expect(requireStaff()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    resolveContext.mockResolvedValue(vendor);
    await expect(requireStaff()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
