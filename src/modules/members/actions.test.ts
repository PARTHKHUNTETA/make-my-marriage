import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const requireAdmin = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const getWedding = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const svc = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  cancelPendingInvite: vi.fn(),
  changeMemberRole: vi.fn(),
  getProfile: vi.fn(),
  inviteMember: vi.fn(),
  removeMember: vi.fn(),
  resendInvite: vi.fn(),
}));
vi.mock("@/lib/authz", () => ({ requireAdmin, requireUser }));
vi.mock("@/lib/ratelimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/ratelimit")>()),
  consumeRateLimit,
}));
vi.mock("@/modules/wedding/service", () => ({ getWedding }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("./service", () => svc);

import {
  acceptInviteAction,
  cancelInviteAction,
  changeRoleAction,
  inviteMemberAction,
  removeMemberAction,
  resendInviteAction,
} from "./actions";

const W = "a".repeat(24);
const ID = "b".repeat(24);
const admin = { kind: "member", userId: "u-admin", weddingId: W, role: "admin" };

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue(admin);
  requireUser.mockReset().mockResolvedValue({ kind: "user", userId: "u1" });
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
  getWedding.mockReset().mockResolvedValue({ title: "Priya weds Aarav" });
  revalidatePath.mockReset();
  for (const fn of Object.values(svc)) fn.mockReset().mockResolvedValue({});
  svc.getProfile.mockResolvedValue({ name: "Priya Sharma" });
  svc.inviteMember.mockResolvedValue({ inviteId: "i1", renewed: false });
});

const adminOnly: Array<[string, (input: unknown) => Promise<unknown>, unknown, keyof typeof svc]> =
  [
    ["inviteMemberAction", inviteMemberAction, { email: "rahul@example.com" }, "inviteMember"],
    ["resendInviteAction", resendInviteAction, { inviteId: ID }, "resendInvite"],
    ["cancelInviteAction", cancelInviteAction, { inviteId: ID }, "cancelPendingInvite"],
    ["changeRoleAction", changeRoleAction, { memberId: ID, role: "admin" }, "changeMemberRole"],
    ["removeMemberAction", removeMemberAction, { memberId: ID }, "removeMember"],
  ];

describe.each(adminOnly)("%s", (_name, action, input, serviceCall) => {
  it("is for admins only: a manager is forbidden and nothing happens", async () => {
    requireAdmin.mockRejectedValue(new AppError("FORBIDDEN", "Only an admin can do this"));
    expect(await action(input)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    for (const fn of Object.values(svc)) expect(fn).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("requires sign-in", async () => {
    requireAdmin.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in to continue"));
    expect(await action(input)).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("refreshes the members page after succeeding", async () => {
    expect(await action(input)).toMatchObject({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/settings/members");
  });

  it("returns the service's error as a value, and does not refresh the page", async () => {
    svc[serviceCall].mockRejectedValue(new AppError("NOT_FOUND", "Not found."));
    expect(await action(input)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("inviteMemberAction", () => {
  it("takes the wedding and inviter from the session, never from the input", async () => {
    await inviteMemberAction({
      email: "Rahul@Example.com",
      weddingId: "f".repeat(24),
      invitedByUserId: "attacker",
    });
    expect(svc.inviteMember).toHaveBeenCalledWith({
      weddingId: W,
      invitedByUserId: "u-admin",
      email: "rahul@example.com",
      weddingTitle: "Priya weds Aarav",
      inviterName: "Priya Sharma",
    });
  });

  it("caps invitations at 20 per wedding per day, hashing the wedding id", async () => {
    await inviteMemberAction({ email: "rahul@example.com" });
    const [action, subject, rule] = consumeRateLimit.mock.calls[0]!;
    expect(action).toBe("invite");
    expect(subject).toMatch(/^wedding:[0-9a-f]{32}$/);
    expect(rule).toEqual({ limit: 20, windowSeconds: 86_400 });
  });

  it("stops at the limit without sending", async () => {
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Too many attempts."));
    expect(await inviteMemberAction({ email: "rahul@example.com" })).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(svc.inviteMember).not.toHaveBeenCalled();
  });

  it("rejects a bad email with field details before anything else", async () => {
    const result = await inviteMemberAction({ email: "nope" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(svc.inviteMember).not.toHaveBeenCalled();
  });

  it("passes the 'already in a wedding' error through to the form", async () => {
    svc.inviteMember.mockRejectedValue(
      new AppError("EMAIL_IN_USE", "This email address already belongs to a wedding."),
    );
    expect(await inviteMemberAction({ email: "rahul@example.com" })).toMatchObject({
      ok: false,
      error: { code: "EMAIL_IN_USE" },
    });
  });

  it("returns whether the invitation was renewed", async () => {
    svc.inviteMember.mockResolvedValue({ inviteId: "i1", renewed: true });
    expect(await inviteMemberAction({ email: "rahul@example.com" })).toEqual({
      ok: true,
      data: { inviteId: "i1", renewed: true },
    });
  });
});

describe("other team actions use the admin's own wedding", () => {
  it("resendInviteAction", async () => {
    await resendInviteAction({ inviteId: ID, weddingId: "f".repeat(24) });
    expect(svc.resendInvite).toHaveBeenCalledWith({
      weddingId: W,
      inviteId: ID,
      weddingTitle: "Priya weds Aarav",
      inviterName: "Priya Sharma",
    });
    expect(consumeRateLimit).toHaveBeenCalled();
  });

  it("cancelInviteAction", async () => {
    await cancelInviteAction({ inviteId: ID, weddingId: "f".repeat(24) });
    expect(svc.cancelPendingInvite).toHaveBeenCalledWith(W, ID);
  });

  it("changeRoleAction", async () => {
    await changeRoleAction({ memberId: ID, role: "manager", weddingId: "f".repeat(24) });
    expect(svc.changeMemberRole).toHaveBeenCalledWith({
      weddingId: W,
      memberId: ID,
      role: "manager",
    });
  });

  it("removeMemberAction", async () => {
    await removeMemberAction({ memberId: ID, weddingId: "f".repeat(24) });
    expect(svc.removeMember).toHaveBeenCalledWith({ weddingId: W, memberId: ID });
  });

  it.each([
    ["a bad role", changeRoleAction, { memberId: ID, role: "owner" }],
    ["a malformed member id", removeMemberAction, { memberId: "../etc" }],
    ["a malformed invite id", cancelInviteAction, { inviteId: "x" }],
    ["a missing member id", changeRoleAction, { role: "admin" }],
  ])("rejects %s", async (_label, action, input) => {
    expect(await (action as (i: unknown) => Promise<unknown>)(input)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
  });
});

describe("acceptInviteAction", () => {
  const token = "abcdefghijklmnopqrstuv";

  it("works for any signed-in account, using the account from the session", async () => {
    svc.acceptInvite.mockResolvedValue({ weddingId: W });
    expect(await acceptInviteAction({ token, userId: "attacker" })).toEqual({
      ok: true,
      data: { weddingId: W },
    });
    expect(svc.acceptInvite).toHaveBeenCalledWith("u1", token);
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it("requires sign-in", async () => {
    requireUser.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in to continue"));
    expect(await acceptInviteAction({ token })).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(svc.acceptInvite).not.toHaveBeenCalled();
  });

  it("passes the 'wrong address' error through", async () => {
    svc.acceptInvite.mockRejectedValue(
      new AppError("FORBIDDEN", "This invitation was sent to a different email address."),
    );
    expect(await acceptInviteAction({ token })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });
});
