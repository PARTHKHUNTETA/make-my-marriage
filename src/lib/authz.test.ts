import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "./context";

const resolveContext = vi.hoisted(() => vi.fn<() => Promise<Context>>());
vi.mock("@/lib/context", () => ({ resolveContext }));

import { canManageMembers, requireAdmin, requireMember, requireVendor } from "./authz";

const admin: Context = { kind: "member", userId: "u1", weddingId: "w1", role: "admin" };
const manager: Context = { kind: "member", userId: "u2", weddingId: "w1", role: "manager" };
const vendor: Context = { kind: "vendor", vendorAccountId: "v1" };
const guest: Context = { kind: "guest", weddingId: "w1", guestId: "g1" };
const anonymous: Context = { kind: "anonymous" };

beforeEach(() => {
  resolveContext.mockReset();
});

describe("canManageMembers", () => {
  it("is true only for an admin member", () => {
    expect(canManageMembers(admin)).toBe(true);
    expect(canManageMembers(manager)).toBe(false);
    expect(canManageMembers(vendor)).toBe(false);
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
});

describe("requireVendor", () => {
  it("allows a vendor", async () => {
    resolveContext.mockResolvedValue(vendor);
    await expect(requireVendor()).resolves.toBe(vendor);
  });

  it("never lets a wedding member into the vendor space", async () => {
    resolveContext.mockResolvedValue(admin);
    await expect(requireVendor()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
