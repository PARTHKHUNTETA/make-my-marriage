"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireAdmin, requireUser } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { getWedding } from "@/modules/wedding/service";
import {
  acceptInviteSchema,
  changeRoleSchema,
  inviteIdSchema,
  inviteMemberSchema,
  memberIdSchema,
} from "./schema";
import {
  acceptInvite,
  cancelPendingInvite,
  changeMemberRole,
  getProfile,
  inviteMember,
  removeMember,
  resendInvite,
} from "./service";

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
    const ctx = await requireAdmin();
    const { email } = inviteMemberSchema.parse(input);
    await limitInvites(ctx.weddingId);
    const names = await inviteContext(ctx);
    const result = await inviteMember({
      weddingId: ctx.weddingId,
      invitedByUserId: ctx.userId,
      email,
      ...names,
    });
    revalidatePath(TEAM_PAGE);
    return result;
  });
}

export async function resendInviteAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireAdmin();
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
    const ctx = await requireAdmin();
    const { inviteId } = inviteIdSchema.parse(input);
    await cancelPendingInvite(ctx.weddingId, inviteId);
    revalidatePath(TEAM_PAGE);
    return {};
  });
}

export async function changeRoleAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireAdmin();
    const { memberId, role } = changeRoleSchema.parse(input);
    await changeMemberRole({ weddingId: ctx.weddingId, memberId, role });
    revalidatePath(TEAM_PAGE);
    return {};
  });
}

export async function removeMemberAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireAdmin();
    const { memberId } = memberIdSchema.parse(input);
    await removeMember({ weddingId: ctx.weddingId, memberId });
    revalidatePath(TEAM_PAGE);
    return {};
  });
}

// Anyone signed in (the invitation itself decides whether it fits them), not just admins.
export async function acceptInviteAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireUser();
    const { token } = acceptInviteSchema.parse(input);
    return acceptInvite(ctx.userId, token);
  });
}
