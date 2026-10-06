import { MongoServerError, ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "@/lib/tokens";

const session = { id: "txn" };
const repo = vi.hoisted(() => ({
  cancelInvite: vi.fn(),
  consumeInvite: vi.fn(),
  deleteMembership: vi.fn(),
  findInviteByTokenHash: vi.fn(),
  findMembership: vi.fn(),
  findMembershipByUserId: vi.fn(),
  findPendingInviteByEmail: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  findUsersByIds: vi.fn(),
  insertInvite: vi.fn(),
  insertMembership: vi.fn(),
  insertUser: vi.fn(),
  listMemberships: vi.fn(),
  listPendingInvites: vi.fn(),
  lockAdmins: vi.fn(),
  markEmailVerified: vi.fn(),
  renewInvite: vi.fn(),
  setMemberRole: vi.fn(),
  findAuthState: vi.fn(),
  setResetToken: vi.fn(),
  setVerifyToken: vi.fn(),
  consumeResetToken: vi.fn(),
  consumeVerifyToken: vi.fn(),
}));
const queueEmail = vi.hoisted(() => vi.fn());
const unassignMember = vi.hoisted(() => vi.fn());
vi.mock("./repository", () => repo);
vi.mock("@/lib/email", () => ({ queueEmail }));
vi.mock("@/modules/tasks/service", () => ({ unassignMember }));
vi.mock("@/lib/app-url", () => ({ absoluteUrl: (path: string) => `http://app.test${path}` }));
vi.mock("@/lib/db", () => ({ inTransaction: (work: (s: unknown) => unknown) => work(session) }));

import {
  acceptInvite,
  cancelPendingInvite,
  changeMemberRole,
  inviteMember,
  listTeam,
  previewInvite,
  removeMember,
  resendInvite,
  signUpWithInvite,
} from "./service";

const W = new ObjectId().toHexString();
const inviterId = new ObjectId();
const tokenIn = (url: string) => url.split("/").pop()!;
const inviteDoc = (extra: Record<string, unknown> = {}) => ({
  _id: new ObjectId(),
  weddingId: new ObjectId(W),
  email: "rahul@example.com",
  tokenHash: "h",
  status: "pending",
  invitedByUserId: inviterId,
  expiresAt: new Date(Date.now() + 3 * 86_400_000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...extra,
});
const userDoc = (extra: Record<string, unknown> = {}) => ({
  _id: new ObjectId(),
  name: "Rahul Sharma",
  email: "rahul@example.com",
  passwordHash: "x",
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...extra,
});
const member = (role: "admin" | "manager") => ({
  _id: new ObjectId(),
  weddingId: new ObjectId(W),
  userId: new ObjectId(),
  role,
  joinedAt: new Date(),
});

beforeEach(() => {
  for (const fn of Object.values(repo)) fn.mockReset();
  queueEmail.mockReset().mockResolvedValue(undefined);
  repo.findUserByEmail.mockResolvedValue(null);
  repo.findMembershipByUserId.mockResolvedValue(null);
  repo.findPendingInviteByEmail.mockResolvedValue(null);
  repo.insertInvite.mockImplementation(async (_w, input) =>
    inviteDoc({ email: input.email, tokenHash: input.tokenHash, expiresAt: input.expiresAt }),
  );
  repo.renewInvite.mockImplementation(async () => inviteDoc());
  repo.lockAdmins.mockResolvedValue(2);
});

const base = {
  weddingId: W,
  invitedByUserId: inviterId.toHexString(),
  inviterName: "Priya Sharma",
  weddingTitle: "Priya weds Aarav",
  email: "rahul@example.com",
};

describe("inviteMember", () => {
  it("stores only a hash, valid for 7 days, and emails a join link", async () => {
    const result = await inviteMember(base);
    expect(result.renewed).toBe(false);

    const [weddingId, stored] = repo.insertInvite.mock.calls[0]!;
    expect(weddingId).toBe(W);
    expect(stored).toMatchObject({
      email: "rahul@example.com",
      invitedByUserId: inviterId.toHexString(),
    });
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(6.99 * 86_400_000);
    expect(stored.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(7 * 86_400_000);

    const mail = queueEmail.mock.calls[0]![0];
    expect(mail).toMatchObject({
      type: "member_invite",
      toEmail: "rahul@example.com",
      weddingId: W,
    });
    expect(mail.payload).toMatchObject({
      inviterName: "Priya Sharma",
      weddingTitle: "Priya weds Aarav",
      expiresInDays: "7",
    });
    const token = tokenIn(mail.payload.url);
    expect(mail.payload.url).toBe(`http://app.test/join/${token}`);
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(stored.tokenHash).not.toContain(token);
  });

  it("renews an existing pending invitation instead of creating a second live link", async () => {
    const pending = inviteDoc({ tokenHash: "old-hash" });
    repo.findPendingInviteByEmail.mockResolvedValue(pending);
    const result = await inviteMember(base);
    expect(result).toMatchObject({ renewed: true });
    expect(repo.insertInvite).not.toHaveBeenCalled();
    const [weddingId, inviteId, newHash] = repo.renewInvite.mock.calls[0]!;
    expect([weddingId, inviteId]).toEqual([W, pending._id.toHexString()]);
    expect(newHash).not.toBe("old-hash");
    expect(queueEmail).toHaveBeenCalledOnce();
  });

  it("refuses an address that already belongs to a wedding, and sends nothing", async () => {
    repo.findUserByEmail.mockResolvedValue(userDoc());
    repo.findMembershipByUserId.mockResolvedValue(member("manager"));
    await expect(inviteMember(base)).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    expect(repo.insertInvite).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
  });

  it("allows an address that has an account but no wedding yet", async () => {
    repo.findUserByEmail.mockResolvedValue(userDoc());
    await expect(inviteMember(base)).resolves.toMatchObject({ renewed: false });
  });

  it("reports NOT_FOUND if the pending invitation vanished mid-renewal", async () => {
    repo.findPendingInviteByEmail.mockResolvedValue(inviteDoc());
    repo.renewInvite.mockResolvedValue(null);
    await expect(inviteMember(base)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(queueEmail).not.toHaveBeenCalled();
  });
});

describe("resendInvite and cancelPendingInvite", () => {
  const inviteId = new ObjectId().toHexString();

  it("resending gives a new link to the invited address", async () => {
    repo.renewInvite.mockResolvedValue(inviteDoc({ email: "sita@example.com" }));
    await resendInvite({
      weddingId: W,
      inviteId,
      inviterName: "Priya",
      weddingTitle: "Priya weds Aarav",
    });
    expect(queueEmail.mock.calls[0]![0]).toMatchObject({
      type: "member_invite",
      toEmail: "sita@example.com",
    });
    expect(repo.renewInvite.mock.calls[0]![2]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("resending an invitation that is gone is NOT_FOUND", async () => {
    repo.renewInvite.mockResolvedValue(null);
    await expect(
      resendInvite({ weddingId: W, inviteId, inviterName: "P", weddingTitle: "T" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(queueEmail).not.toHaveBeenCalled();
  });

  it("cancels a pending invitation, and says so when there is nothing to cancel", async () => {
    repo.cancelInvite.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(cancelPendingInvite(W, inviteId)).resolves.toBeUndefined();
    await expect(cancelPendingInvite(W, inviteId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("changeMemberRole", () => {
  const run = (target: ReturnType<typeof member> | null, role: "admin" | "manager", admins = 2) => {
    repo.lockAdmins.mockResolvedValue(admins);
    repo.findMembership.mockResolvedValue(target);
    return changeMemberRole({
      weddingId: W,
      memberId: target?._id.toHexString() ?? new ObjectId().toHexString(),
      role,
    });
  };

  it("promotes a manager to admin inside the transaction", async () => {
    const target = member("manager");
    await run(target, "admin");
    expect(repo.setMemberRole).toHaveBeenCalledWith(W, target._id.toHexString(), "admin", {
      session,
    });
  });

  it("demotes an admin when another admin remains", async () => {
    const target = member("admin");
    await run(target, "manager", 2);
    expect(repo.setMemberRole).toHaveBeenCalledWith(W, target._id.toHexString(), "manager", {
      session,
    });
  });

  it("refuses to demote the last admin (LAST_ADMIN) and writes nothing", async () => {
    await expect(run(member("admin"), "manager", 1)).rejects.toMatchObject({ code: "LAST_ADMIN" });
    expect(repo.setMemberRole).not.toHaveBeenCalled();
  });

  it("counts the admins under a lock before deciding", async () => {
    await run(member("manager"), "admin");
    expect(repo.lockAdmins).toHaveBeenCalledWith(W, { session });
  });

  it("does nothing when the role is already what was asked", async () => {
    await run(member("admin"), "admin", 1);
    expect(repo.setMemberRole).not.toHaveBeenCalled();
  });

  it("reports an unknown member (or one in another wedding) as NOT_FOUND", async () => {
    await expect(run(null, "admin")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("removeMember", () => {
  const run = (target: ReturnType<typeof member> | null, admins = 2) => {
    repo.lockAdmins.mockResolvedValue(admins);
    repo.findMembership.mockResolvedValue(target);
    return removeMember({
      weddingId: W,
      memberId: target?._id.toHexString() ?? new ObjectId().toHexString(),
    });
  };

  it("removes a manager", async () => {
    const target = member("manager");
    await run(target, 1);
    expect(repo.deleteMembership).toHaveBeenCalledWith(W, target._id.toHexString(), { session });
  });

  it("unassigns the removed member's tasks in the same transaction", async () => {
    const target = member("manager");
    await run(target, 1);
    expect(unassignMember).toHaveBeenCalledWith(W, target._id.toHexString(), { session });
  });

  it("does not touch tasks when the removal is refused", async () => {
    unassignMember.mockClear();
    await expect(run(member("admin"), 1)).rejects.toMatchObject({ code: "LAST_ADMIN" });
    expect(unassignMember).not.toHaveBeenCalled();
  });

  it("removes an admin while another admin remains", async () => {
    await run(member("admin"), 2);
    expect(repo.deleteMembership).toHaveBeenCalledOnce();
  });

  it("refuses to remove the last admin (LAST_ADMIN)", async () => {
    await expect(run(member("admin"), 1)).rejects.toMatchObject({ code: "LAST_ADMIN" });
    expect(repo.deleteMembership).not.toHaveBeenCalled();
  });

  it("reports an unknown member as NOT_FOUND", async () => {
    await expect(run(null)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("listTeam", () => {
  it("joins members to their accounts, skips orphans, and flags expired invitations", async () => {
    const a = userDoc({ name: "Priya", email: "priya@example.com" });
    const ma = { ...member("admin"), userId: a._id };
    const orphan = member("manager");
    repo.listMemberships.mockResolvedValue([ma, orphan]);
    repo.findUsersByIds.mockResolvedValue([a]);
    repo.listPendingInvites.mockResolvedValue([
      inviteDoc(),
      inviteDoc({ email: "late@example.com", expiresAt: new Date(Date.now() - 1000) }),
    ]);

    const team = await listTeam(W);
    expect(team.members).toEqual([
      {
        memberId: ma._id.toHexString(),
        userId: a._id.toHexString(),
        name: "Priya",
        email: "priya@example.com",
        role: "admin",
        joinedAt: ma.joinedAt,
      },
    ]);
    expect(team.invites.map((i) => [i.email, i.expired])).toEqual([
      ["rahul@example.com", false],
      ["late@example.com", true],
    ]);
  });

  it("a brand-new invitation has 7 days left, and 1 day shows as 1", async () => {
    repo.listMemberships.mockResolvedValue([]);
    repo.findUsersByIds.mockResolvedValue([]);
    repo.listPendingInvites.mockResolvedValue([
      inviteDoc({ expiresAt: new Date(Date.now() + 7 * 86_400_000) }),
      inviteDoc({ expiresAt: new Date(Date.now() + 3_600_000) }),
    ]);
    expect((await listTeam(W)).invites.map((i) => i.daysLeft)).toEqual([7, 1]);
  });

  it("never exposes password hashes or token hashes", async () => {
    const a = userDoc({ passwordHash: "SECRET-HASH" });
    repo.listMemberships.mockResolvedValue([{ ...member("admin"), userId: a._id }]);
    repo.findUsersByIds.mockResolvedValue([a]);
    repo.listPendingInvites.mockResolvedValue([inviteDoc({ tokenHash: "SECRET-TOKEN-HASH" })]);
    const text = JSON.stringify(await listTeam(W));
    expect(text).not.toContain("SECRET-HASH");
    expect(text).not.toContain("SECRET-TOKEN-HASH");
  });
});

describe("previewInvite", () => {
  it("looks the invitation up by hash and says whether it is still valid", async () => {
    repo.findInviteByTokenHash
      .mockResolvedValueOnce(inviteDoc())
      .mockResolvedValueOnce(inviteDoc({ expiresAt: new Date(Date.now() - 1) }));
    expect(await previewInvite("tok-1234567890")).toMatchObject({
      state: "valid",
      email: "rahul@example.com",
      weddingId: W,
    });
    expect(repo.findInviteByTokenHash.mock.calls[0]![0]).toBe(hashToken("tok-1234567890"));
    expect(await previewInvite("tok-1234567890")).toMatchObject({ state: "expired" });
  });

  it("treats an unknown or cancelled invitation as not found", async () => {
    repo.findInviteByTokenHash.mockResolvedValue(null);
    expect(await previewInvite("tok-1234567890")).toBeNull();
  });
});

describe("signUpWithInvite", () => {
  const input = {
    name: "Rahul Sharma",
    password: "a-long-enough-password",
    token: "tok-1234567890",
  };

  beforeEach(() => {
    repo.findInviteByTokenHash.mockResolvedValue(inviteDoc());
    repo.insertUser.mockImplementation(async (u) =>
      userDoc({
        email: u.email,
        name: u.name,
        passwordHash: u.passwordHash,
        emailVerified: u.emailVerified,
      }),
    );
    repo.consumeInvite.mockResolvedValue(inviteDoc());
  });

  it("creates a verified account from the invitation's email and joins it as a Manager, atomically", async () => {
    const user = await signUpWithInvite(input);
    expect(repo.insertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "rahul@example.com",
        name: "Rahul Sharma",
        emailVerified: true,
      }),
      { session },
    );
    expect(repo.consumeInvite.mock.calls[0]![0]).toBe(hashToken("tok-1234567890"));
    expect(repo.consumeInvite.mock.calls[0]![2]).toEqual({ session });
    expect(repo.insertMembership).toHaveBeenCalledWith(
      { weddingId: W, userId: user.id, role: "manager" },
      { session },
    );
    expect(user).toMatchObject({ email: "rahul@example.com", emailVerified: true });
  });

  it("stores the password as an Argon2id hash", async () => {
    await signUpWithInvite(input);
    const stored = repo.insertUser.mock.calls[0]![0].passwordHash as string;
    expect(stored.startsWith("$argon2id$")).toBe(true);
    expect(stored).not.toContain(input.password);
  });

  it("an unknown, cancelled or expired link is LINK_INVALID and creates nothing", async () => {
    repo.findInviteByTokenHash.mockResolvedValueOnce(null);
    await expect(signUpWithInvite(input)).rejects.toMatchObject({ code: "LINK_INVALID" });
    repo.findInviteByTokenHash.mockResolvedValueOnce(
      inviteDoc({ expiresAt: new Date(Date.now() - 1) }),
    );
    await expect(signUpWithInvite(input)).rejects.toMatchObject({ code: "LINK_INVALID" });
    expect(repo.insertUser).not.toHaveBeenCalled();
  });

  it("tells someone who already has an account to sign in instead (EMAIL_IN_USE)", async () => {
    repo.findUserByEmail.mockResolvedValue(userDoc());
    await expect(signUpWithInvite(input)).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    expect(repo.insertUser).not.toHaveBeenCalled();
  });

  it("loses cleanly if someone else used the invitation first", async () => {
    repo.consumeInvite.mockResolvedValue(null);
    await expect(signUpWithInvite(input)).rejects.toMatchObject({ code: "LINK_INVALID" });
    expect(repo.insertMembership).not.toHaveBeenCalled();
  });

  it("loses cleanly if the email was taken in the meantime", async () => {
    repo.insertUser.mockResolvedValue(null);
    await expect(signUpWithInvite(input)).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    expect(repo.consumeInvite).not.toHaveBeenCalled();
  });
});

describe("acceptInvite", () => {
  const me = userDoc();
  const token = "tok-1234567890";

  beforeEach(() => {
    repo.findUserById.mockResolvedValue(me);
    repo.findInviteByTokenHash.mockResolvedValue(inviteDoc());
    repo.consumeInvite.mockResolvedValue(inviteDoc());
  });

  it("joins the signed-in person as a Manager and marks their email verified", async () => {
    const result = await acceptInvite(me._id.toHexString(), token);
    expect(result).toEqual({ weddingId: W });
    expect(repo.insertMembership).toHaveBeenCalledWith(
      { weddingId: W, userId: me._id.toHexString(), role: "manager" },
      { session },
    );
    expect(repo.markEmailVerified).toHaveBeenCalledWith(me._id.toHexString(), { session });
  });

  it("refuses an invitation that was sent to a different email address", async () => {
    repo.findInviteByTokenHash.mockResolvedValue(inviteDoc({ email: "someone-else@example.com" }));
    await expect(acceptInvite(me._id.toHexString(), token)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(repo.consumeInvite).not.toHaveBeenCalled();
  });

  it("refuses someone who already belongs to a wedding", async () => {
    repo.findMembershipByUserId.mockResolvedValue(member("admin"));
    await expect(acceptInvite(me._id.toHexString(), token)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(repo.consumeInvite).not.toHaveBeenCalled();
  });

  it("an unknown, cancelled or expired link is LINK_INVALID", async () => {
    repo.findInviteByTokenHash.mockResolvedValueOnce(null);
    await expect(acceptInvite(me._id.toHexString(), token)).rejects.toMatchObject({
      code: "LINK_INVALID",
    });
    repo.findInviteByTokenHash.mockResolvedValueOnce(
      inviteDoc({ expiresAt: new Date(Date.now() - 1) }),
    );
    await expect(acceptInvite(me._id.toHexString(), token)).rejects.toMatchObject({
      code: "LINK_INVALID",
    });
  });

  it("is LINK_INVALID if a second click arrives after the invitation was used", async () => {
    repo.consumeInvite.mockResolvedValue(null);
    await expect(acceptInvite(me._id.toHexString(), token)).rejects.toMatchObject({
      code: "LINK_INVALID",
    });
    expect(repo.insertMembership).not.toHaveBeenCalled();
  });

  it("maps a concurrent 'already a member' database conflict to FORBIDDEN", async () => {
    repo.insertMembership.mockRejectedValue(
      new MongoServerError({ code: 11000, message: "E11000" }),
    );
    await expect(acceptInvite(me._id.toHexString(), token)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
