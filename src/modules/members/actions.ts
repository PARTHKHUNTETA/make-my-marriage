"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { recordAudit } from "@/lib/audit";
import { setActiveWeddingId } from "@/lib/active-wedding";
import { requireMember, requirePermission, requireUser } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { announceMemberJoined, notifyMembers } from "@/modules/notifications/service";
import { getWedding } from "@/modules/wedding/service";
import {
  acceptInviteSchema,
  inviteIdSchema,
  inviteMemberSchema,
  paletteSchema,
  roleIdSchema,
  roleInputSchema,
  setMemberRolesSchema,
  switchWeddingSchema,
  memberIdSchema,
} from "./schema";
import {
  acceptInvite,
  belongsToWedding,
  cancelPendingInvite,
  getProfile,
  inviteMember,
  listTeam,
  removeMember,
  updatePalette,
  resendInvite,
} from "./service";
import { checkGivableRoles, createRole, deleteRole, setMemberRoles, updateRole } from "./roles";

// Server Actions for team management. Each one validates its input, resolves who is calling,
// checks permission (admin-only unless noted), then calls the service. Failures come back as
// values (lib/action.ts). The wedding always comes from the signed-in admin, never from input.

const TEAM_PAGE = "/settings/members";
const INVITES_PER_DAY = 20;

// Names for the email, gathered here so the members service need not depend on the wedding module.
async function inviteContext(ctx: { weddingId: string; userId: string }) {
  const [wedding, profile] = await Promise.all([getWedding(ctx.weddingId), getProfile(ctx.userId)]);
  if (!wedding || !profile)
    throw new AppError("NOT_FOUND", "We couldn't load your wedding. Please refresh.");
  // Invitations are emails to other people, so the sender must have confirmed their own address.
  if (!profile.emailVerified)
    throw new AppError(
      "FORBIDDEN",
      "Confirm your email address before inviting people. We sent you a link when you signed up.",
    );
  return { weddingTitle: wedding.title, inviterName: profile.name };
}

// Invitations are emails to arbitrary addresses, so they are capped per wedding per day.
const limitInvites = (weddingId: string) =>
  consumeRateLimit("invite", subjectKey("wedding", weddingId), {
    limit: INVITES_PER_DAY,
    windowSeconds: 24 * 60 * 60,
  });

export async function inviteMemberAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("member.invite");
    const parsed = inviteMemberSchema.parse(input);
    // The roles offered must exist and be within what the inviter holds.
    const roleIds = await checkGivableRoles(ctx.weddingId, ctx.permissions, parsed.roleIds);
    await limitInvites(ctx.weddingId);
    const names = await inviteContext(ctx);
    const result = await inviteMember({
      weddingId: ctx.weddingId,
      invitedByUserId: ctx.userId,
      email: parsed.email,
      roleIds,
      ...names,
    });
    await recordAudit({
      weddingId: ctx.weddingId,
      actorUserId: ctx.userId,
      action: "member.invite",
      target: parsed.email,
      after: { roleIds },
    });
    revalidatePath(TEAM_PAGE);
    return result;
  });
}

export async function resendInviteAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("member.invite");
    const { inviteId } = inviteIdSchema.parse(input);
    await limitInvites(ctx.weddingId);
    const names = await inviteContext(ctx);
    await resendInvite({ weddingId: ctx.weddingId, inviteId, ...names });
    revalidatePath(TEAM_PAGE);
    return {};
  });
}

export async function cancelInviteAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("member.invite");
    const { inviteId } = inviteIdSchema.parse(input);
    const email = (await listTeam(ctx.weddingId)).invites.find(
      (i) => i.inviteId === inviteId,
    )?.email;
    await cancelPendingInvite(ctx.weddingId, inviteId);
    await recordAudit({
      weddingId: ctx.weddingId,
      actorUserId: ctx.userId,
      action: "member.invite_cancel",
      target: email ?? "an invitation",
    });
    revalidatePath(TEAM_PAGE);
    return {};
  });
}

// Gives a member exactly these roles (see roles.ts for the rules that keep this safe).
export async function setMemberRolesAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("member.manage");
    const { memberId, roleIds } = setMemberRolesSchema.parse(input);
    const who = (await listTeam(ctx.weddingId)).members.find((m) => m.memberId === memberId);
    const change = await setMemberRoles({
      weddingId: ctx.weddingId,
      actor: ctx,
      memberId,
      roleIds,
    });
    await recordAudit({
      weddingId: ctx.weddingId,
      actorUserId: ctx.userId,
      action: "member.roles",
      target: who?.name ?? "a member",
      before: { roleIds: change.before },
      after: { roleIds: change.after },
    });
    revalidatePath(TEAM_PAGE);
    return {};
  });
}

// ---- custom roles ----

const ROLES_PAGE = "/settings/roles";

export async function createRoleAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("role.manage");
    const parsed = roleInputSchema.parse(input);
    const role = await createRole(ctx.weddingId, ctx.permissions, parsed);
    await recordAudit({
      weddingId: ctx.weddingId,
      actorUserId: ctx.userId,
      action: "role.create",
      target: role.name,
      after: { grants: parsed.grants },
    });
    revalidatePath(ROLES_PAGE);
    return { id: role.id };
  });
}

export async function updateRoleAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("role.manage");
    const { roleId, ...fields } = (input ?? {}) as { roleId?: unknown };
    const id = roleIdSchema.parse({ roleId }).roleId;
    const parsed = roleInputSchema.parse(fields);
    const { before } = await updateRole(ctx.weddingId, ctx.permissions, id, parsed);
    await recordAudit({
      weddingId: ctx.weddingId,
      actorUserId: ctx.userId,
      action: "role.update",
      target: parsed.name,
      before: { name: before.name, grants: before.grants },
      after: { name: parsed.name, grants: parsed.grants },
    });
    // Everyone holding the role is affected at once; their next page load shows it.
    revalidatePath("/", "layout");
    return {};
  });
}

export async function deleteRoleAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("role.manage");
    const { before } = await deleteRole(ctx.weddingId, roleIdSchema.parse(input).roleId);
    await recordAudit({
      weddingId: ctx.weddingId,
      actorUserId: ctx.userId,
      action: "role.delete",
      target: before.name,
      before: { grants: before.grants },
    });
    revalidatePath(ROLES_PAGE);
    return {};
  });
}

export async function removeMemberAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("member.manage");
    const { memberId } = memberIdSchema.parse(input);
    const who = (await listTeam(ctx.weddingId)).members.find((m) => m.memberId === memberId);
    await removeMember({ weddingId: ctx.weddingId, memberId });
    await recordAudit({
      weddingId: ctx.weddingId,
      actorUserId: ctx.userId,
      action: "member.remove",
      target: who?.name ?? "a member",
      before: { roleIds: who?.roleIds },
    });
    if (who)
      await notifyMembers(ctx.weddingId, {
        type: "member_change",
        message: `${who.name} was removed from the wedding team.`,
        link: "/settings/members",
        audience: "admins",
        exceptMemberId: ctx.memberId,
      });
    revalidatePath(TEAM_PAGE);
    return {};
  });
}

// Anyone signed in (the invitation itself decides whether it fits them), not just admins.
export async function acceptInviteAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireUser();
    const { token } = acceptInviteSchema.parse(input);
    const joined = await acceptInvite(ctx.userId, token);
    await announceMemberJoined(ctx.userId, joined.weddingId);
    // Land in the wedding they just joined.
    await setActiveWeddingId(joined.weddingId);
    return joined;
  });
}

// Any member (not only an admin) chooses their own colour theme. Which member is decided by the
// signed-in session, never by the request, so nobody can change anyone else's.
export async function setPaletteAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { palette } = paletteSchema.parse(input);
    await updatePalette(ctx.weddingId, ctx.memberId, palette);
    // Every page paints with it, so every page is refreshed.
    revalidatePath("/", "layout");
    return { palette };
  });
}

// Switches which of their weddings this person is working in. The choice must be one of the
// weddings the account really belongs to.
export async function switchWeddingAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireUser();
    const { weddingId } = switchWeddingSchema.parse(input);
    if (!(await belongsToWedding(ctx.userId, weddingId)))
      throw new AppError("FORBIDDEN", "You are not part of that wedding.");
    await setActiveWeddingId(weddingId);
    revalidatePath("/", "layout");
    return {};
  });
}
