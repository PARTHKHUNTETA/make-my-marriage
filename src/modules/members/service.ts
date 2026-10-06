import "server-only";
import { MongoServerError, type ClientSession } from "mongodb";
import { inTransaction } from "@/lib/db";
import { absoluteUrl } from "@/lib/app-url";
import { queueEmail } from "@/lib/email";
import { AppError } from "@/lib/errors";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/passwords";
import { generateToken, hashToken } from "@/lib/tokens";
import { unassignMember } from "@/modules/tasks/service";
import {
  cancelInvite,
  consumeInvite,
  consumeResetToken,
  consumeVerifyToken,
  deleteMembership,
  findAuthState,
  findInviteByTokenHash,
  findMembership,
  findMembershipByUserId,
  findPendingInviteByEmail,
  findUsersByIds,
  findUserByEmail,
  findUserById,
  insertInvite,
  insertMembership,
  insertUser,
  listMemberships,
  listPendingInvites,
  lockAdmins,
  markEmailVerified,
  renewInvite,
  setMemberRole,
  setResetToken,
  setVerifyToken,
  type UserDoc,
} from "./repository";
import type {
  InviteSignupInput,
  InviteView,
  LoginInput,
  MemberRole,
  MemberView,
  PublicUser,
  SignupInput,
} from "./schema";

// Business rules for the members module. Input here is already validated by the caller.

function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

// One message for both "no such account" and "wrong password", so login cannot be used to
// discover which emails have accounts.
const BAD_CREDENTIALS = "Incorrect email or password.";

export async function signUp(input: SignupInput): Promise<PublicUser> {
  const user = await insertUser({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
  });
  if (!user) throw new AppError("EMAIL_IN_USE", "An account with this email already exists.");
  // The account exists either way; if the email cannot be queued, "resend" is on the dashboard.
  await sendVerificationEmail(user).catch((err) => {
    console.error(
      "could not queue verification email",
      err instanceof Error ? err.name : "unknown",
    );
  });
  return toPublicUser(user);
}

export async function logIn(input: LoginInput): Promise<PublicUser> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    await burnPasswordCheck(input.password);
    throw new AppError("UNAUTHENTICATED", BAD_CREDENTIALS);
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) {
    throw new AppError("UNAUTHENTICATED", BAD_CREDENTIALS);
  }
  return toPublicUser(user);
}

export async function getProfile(userId: string): Promise<PublicUser | null> {
  const user = await findUserById(userId);
  return user ? toPublicUser(user) : null;
}

export type Membership = { weddingId: string; memberId: string; role: MemberRole };

// Which wedding (and role) an account belongs to, or null before first-time setup.
export async function getMembership(userId: string): Promise<Membership | null> {
  const doc = await findMembershipByUserId(userId);
  return doc
    ? { weddingId: doc.weddingId.toHexString(), memberId: doc._id.toHexString(), role: doc.role }
    : null;
}

// Whether this member belongs to this wedding (used to check who a task is assigned to).
export async function memberExists(weddingId: string, memberId: string): Promise<boolean> {
  return (await findMembership(weddingId, memberId)) !== null;
}

// Attaches the creator of a wedding to it as admin. Called inside the wedding-creation
// transaction, so it takes the session. A user can belong to one wedding only (unique index).
export async function addAdminMember(
  input: { userId: string; weddingId: string },
  options?: { session?: ClientSession },
): Promise<void> {
  try {
    await insertMembership({ ...input, role: "admin" }, options);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) {
      throw new AppError("FORBIDDEN", "You already belong to a wedding.");
    }
    throw err;
  }
}

// ---- email verification and password reset (api-design §3) ----

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export async function getAuthState(userId: string) {
  return findAuthState(userId);
}

// A fresh token each time, so asking again invalidates the previous link.
async function sendVerificationEmail(user: Pick<UserDoc, "_id" | "name" | "email">): Promise<void> {
  const token = generateToken();
  await setVerifyToken(
    user._id.toHexString(),
    hashToken(token),
    new Date(Date.now() + VERIFY_TTL_MS),
  );
  await queueEmail({
    type: "verify",
    toEmail: user.email,
    payload: { name: user.name, url: absoluteUrl(`/verify-email/${token}`) },
  });
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user || user.emailVerified) return;
  await sendVerificationEmail(user);
}

export async function confirmEmail(token: string): Promise<void> {
  const user = await consumeVerifyToken(hashToken(token), new Date());
  if (!user) throw new AppError("LINK_INVALID", "This link has expired or has already been used.");
}

// Always completes without saying whether the address has an account, so this cannot be used
// to discover who is registered.
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user) return;
  const token = generateToken();
  await setResetToken(
    user._id.toHexString(),
    hashToken(token),
    new Date(Date.now() + RESET_TTL_MS),
  );
  await queueEmail({
    type: "reset",
    toEmail: user.email,
    payload: { name: user.name, url: absoluteUrl(`/reset-password/${token}`) },
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  const user = await consumeResetToken(hashToken(token), new Date(), passwordHash);
  if (!user) throw new AppError("LINK_INVALID", "This link has expired or has already been used.");
}

// ---- team: invitations and roles (PRD 3, 5.1, 5.12; api-design §4) ----

const INVITE_TTL_DAYS = 7;
const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function listTeam(
  weddingId: string,
): Promise<{ members: MemberView[]; invites: InviteView[] }> {
  const [memberships, pending] = await Promise.all([
    listMemberships(weddingId),
    listPendingInvites(weddingId),
  ]);
  const people = new Map(
    (await findUsersByIds(memberships.map((m) => m.userId))).map((u) => [u._id.toHexString(), u]),
  );
  const now = Date.now();
  return {
    members: memberships.flatMap((m) => {
      const user = people.get(m.userId.toHexString());
      return user
        ? [
            {
              memberId: m._id.toHexString(),
              userId: user._id.toHexString(),
              name: user.name,
              email: user.email,
              role: m.role,
              joinedAt: m.joinedAt,
            },
          ]
        : [];
    }),
    invites: pending.map((i) => ({
      inviteId: i._id.toHexString(),
      email: i.email,
      expiresAt: i.expiresAt,
      expired: i.expiresAt.getTime() <= now,
      daysLeft: Math.max(0, Math.ceil((i.expiresAt.getTime() - now) / 86_400_000)),
    })),
  };
}

async function sendInviteEmail(input: {
  weddingId: string;
  email: string;
  token: string;
  inviterName: string;
  weddingTitle: string;
}): Promise<void> {
  await queueEmail({
    type: "member_invite",
    toEmail: input.email,
    weddingId: input.weddingId,
    payload: {
      inviterName: input.inviterName,
      weddingTitle: input.weddingTitle,
      url: absoluteUrl(`/join/${input.token}`),
      expiresInDays: String(INVITE_TTL_DAYS),
    },
  });
}

// Invites a person to join as a Manager. An address that already belongs to a wedding cannot be
// invited (a person belongs to exactly one). Inviting someone who already has a pending
// invitation just renews it, so there is never more than one live link per address.
export async function inviteMember(input: {
  weddingId: string;
  invitedByUserId: string;
  inviterName: string;
  weddingTitle: string;
  email: string;
}): Promise<{ inviteId: string; renewed: boolean }> {
  const existing = await findUserByEmail(input.email);
  if (existing && (await findMembershipByUserId(existing._id.toHexString()))) {
    throw new AppError("EMAIL_IN_USE", "This email address already belongs to a wedding.");
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const pending = await findPendingInviteByEmail(input.weddingId, input.email);
  const invite = pending
    ? await renewInvite(input.weddingId, pending._id.toHexString(), hashToken(token), expiresAt)
    : await insertInvite(input.weddingId, {
        email: input.email,
        tokenHash: hashToken(token),
        invitedByUserId: input.invitedByUserId,
        expiresAt,
      });
  if (!invite) throw new AppError("NOT_FOUND", "That invitation no longer exists.");

  await sendInviteEmail({ ...input, token });
  return { inviteId: invite._id.toHexString(), renewed: pending !== null };
}

export async function resendInvite(input: {
  weddingId: string;
  inviteId: string;
  inviterName: string;
  weddingTitle: string;
}): Promise<void> {
  const token = generateToken();
  const invite = await renewInvite(
    input.weddingId,
    input.inviteId,
    hashToken(token),
    new Date(Date.now() + INVITE_TTL_MS),
  );
  if (!invite) throw new AppError("NOT_FOUND", "That invitation no longer exists.");
  await sendInviteEmail({ ...input, email: invite.email, token });
}

export async function cancelPendingInvite(weddingId: string, inviteId: string): Promise<void> {
  if (!(await cancelInvite(weddingId, inviteId))) {
    throw new AppError("NOT_FOUND", "That invitation no longer exists.");
  }
}

const LAST_ADMIN_MESSAGE = "A wedding needs at least one Admin.";

// Promote a Manager or demote an Admin. Demoting the last Admin is refused.
export async function changeMemberRole(input: {
  weddingId: string;
  memberId: string;
  role: MemberRole;
}): Promise<void> {
  await inTransaction(async (session) => {
    const admins = await lockAdmins(input.weddingId, { session });
    const target = await findMembership(input.weddingId, input.memberId);
    if (!target) throw new AppError("NOT_FOUND", "That member is not part of this wedding.");
    if (target.role === input.role) return;
    if (target.role === "admin" && admins <= 1)
      throw new AppError("LAST_ADMIN", LAST_ADMIN_MESSAGE);
    await setMemberRole(input.weddingId, input.memberId, input.role, { session });
  });
}

// Removes someone from this wedding only: their account stays, and they are free to join or
// create another wedding. Removing the last Admin is refused. Their open sessions lose access
// on their next request, because the wedding is looked up per request (see lib/context.ts).
export async function removeMember(input: { weddingId: string; memberId: string }): Promise<void> {
  await inTransaction(async (session) => {
    const admins = await lockAdmins(input.weddingId, { session });
    const target = await findMembership(input.weddingId, input.memberId);
    if (!target) throw new AppError("NOT_FOUND", "That member is not part of this wedding.");
    if (target.role === "admin" && admins <= 1)
      throw new AppError("LAST_ADMIN", LAST_ADMIN_MESSAGE);
    await deleteMembership(input.weddingId, input.memberId, { session });
    // Their tasks stay but belong to no one (PRD 5.4), in the same transaction as the removal.
    await unassignMember(input.weddingId, input.memberId, { session });
  });
}

// ---- joining through an invitation link ----

export type InvitePreview = {
  state: "valid" | "expired";
  email: string;
  weddingId: string;
  invitedByUserId: string;
};

// What the join page needs to show. Anything unknown or cancelled looks the same: not found.
export async function previewInvite(token: string): Promise<InvitePreview | null> {
  const invite = await findInviteByTokenHash(hashToken(token));
  if (!invite) return null;
  return {
    state: invite.expiresAt.getTime() > Date.now() ? "valid" : "expired",
    email: invite.email,
    weddingId: invite.weddingId.toHexString(),
    invitedByUserId: invite.invitedByUserId.toHexString(),
  };
}

const INVITE_LINK_INVALID = "This invitation has expired or is no longer valid.";

// New person, arriving by invitation: creates their account (email taken from the invitation and
// already verified) and joins them as a Manager, all in one transaction.
export async function signUpWithInvite(input: InviteSignupInput): Promise<PublicUser> {
  const tokenHash = hashToken(input.token);
  const invite = await findInviteByTokenHash(tokenHash);
  if (!invite || invite.expiresAt.getTime() <= Date.now()) {
    throw new AppError("LINK_INVALID", INVITE_LINK_INVALID);
  }
  if (await findUserByEmail(invite.email)) {
    throw new AppError(
      "EMAIL_IN_USE",
      "An account already exists for this email. Sign in to join the wedding.",
    );
  }
  const passwordHash = await hashPassword(input.password);

  const user = await inTransaction(async (session) => {
    const created = await insertUser(
      { name: input.name, email: invite.email, passwordHash, emailVerified: true },
      { session },
    );
    if (!created)
      throw new AppError(
        "EMAIL_IN_USE",
        "An account already exists for this email. Sign in to join the wedding.",
      );
    const consumed = await consumeInvite(tokenHash, new Date(), { session });
    if (!consumed) throw new AppError("LINK_INVALID", INVITE_LINK_INVALID);
    await insertMembership(
      {
        weddingId: consumed.weddingId.toHexString(),
        userId: created._id.toHexString(),
        role: "manager",
      },
      { session },
    );
    return created;
  });
  return toPublicUser(user);
}

// Someone who already has an account (and no wedding) accepts while signed in. The invitation
// must have been sent to their own address.
export async function acceptInvite(userId: string, token: string): Promise<{ weddingId: string }> {
  const [user, tokenHash] = [await findUserById(userId), hashToken(token)];
  const invite = await findInviteByTokenHash(tokenHash);
  if (!user || !invite || invite.expiresAt.getTime() <= Date.now()) {
    throw new AppError("LINK_INVALID", INVITE_LINK_INVALID);
  }
  if (invite.email !== user.email) {
    throw new AppError("FORBIDDEN", "This invitation was sent to a different email address.");
  }
  if (await findMembershipByUserId(userId)) {
    throw new AppError("FORBIDDEN", "You already belong to a wedding.");
  }

  return inTransaction(async (session) => {
    const consumed = await consumeInvite(tokenHash, new Date(), { session });
    if (!consumed) throw new AppError("LINK_INVALID", INVITE_LINK_INVALID);
    const weddingId = consumed.weddingId.toHexString();
    try {
      await insertMembership({ weddingId, userId, role: "manager" }, { session });
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) {
        throw new AppError("FORBIDDEN", "You already belong to a wedding.");
      }
      throw err;
    }
    // Following the link proved they own this mailbox.
    await markEmailVerified(userId, { session });
    return { weddingId };
  });
}
