"use server";

import { safeAction } from "@/lib/action";
import { requireMember, requireVendor } from "@/lib/authz";
import { updateMutedTypes } from "@/modules/members/service";
import { muteSchema, notificationIdSchema } from "./schema";
import { getPanel, readAll, readOne } from "./service";

// Server Actions for the bell. The recipient always comes from the signed-in session, never from
// the input, so nobody can read or change anyone else's notifications.

export async function getNotificationsAction() {
  return safeAction(async () => {
    const ctx = await requireMember();
    return getPanel({ type: "member", id: ctx.memberId });
  });
}

export async function markNotificationReadAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await readOne({ type: "member", id: ctx.memberId }, notificationIdSchema.parse(input).id);
    return {};
  });
}

export async function markAllNotificationsReadAction() {
  return safeAction(async () => {
    const ctx = await requireMember();
    await readAll({ type: "member", id: ctx.memberId });
    return {};
  });
}

export async function getVendorNotificationsAction() {
  return safeAction(async () => {
    const ctx = await requireVendor();
    return getPanel({ type: "vendor", id: ctx.vendorAccountId });
  });
}

export async function markVendorNotificationReadAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    await readOne(
      { type: "vendor", id: ctx.vendorAccountId },
      notificationIdSchema.parse(input).id,
    );
    return {};
  });
}

export async function markAllVendorNotificationsReadAction() {
  return safeAction(async () => {
    const ctx = await requireVendor();
    await readAll({ type: "vendor", id: ctx.vendorAccountId });
    return {};
  });
}

export async function saveMutedTypesAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { types } = muteSchema.parse(input);
    await updateMutedTypes(ctx.weddingId, ctx.memberId, types);
    return { types };
  });
}
