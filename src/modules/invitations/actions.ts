"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { getProfile } from "@/modules/members/service";
import { parseDays, reminderSettingsSchema } from "@/modules/wedding/schema";
import { setReminderSettings } from "@/modules/wedding/service";
import { sendInvitationEmails, sendRsvpReminderEmails } from "./sending";

// Server Actions for emailing guests and the reminder settings. Open to Admins and Managers.
// The wedding always comes from the signed-in member. Sending is rate limited per wedding.

const ids = z
  .array(z.string().regex(/^[0-9a-fA-F]{24}$/))
  .min(1)
  .max(1000);
const target = z.union([z.object({ guestIds: ids }), z.object({ all: z.literal(true) })]);
const reminderTarget = z.union([
  z.object({ guestIds: ids }),
  z.object({ nonResponders: z.literal(true) }),
]);

const refresh = () => revalidatePath("/", "layout");

// Emailing other people from this site needs a confirmed email address of your own. Otherwise
// anyone could sign up with any address and send mail to strangers.
async function assertVerified(userId: string) {
  const profile = await getProfile(userId);
  if (!profile?.emailVerified)
    throw new AppError(
      "FORBIDDEN",
      "Confirm your email address first. We sent you a link when you signed up.",
    );
}

async function limit(weddingId: string) {
  await consumeRateLimit("guest-email", subjectKey("wedding", weddingId), {
    limit: 30,
    windowSeconds: 60 * 60,
  });
}

export async function sendInvitationsAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const wanted = target.parse(input);
    await assertVerified(ctx.userId);
    await limit(ctx.weddingId);
    const result = await sendInvitationEmails(ctx.weddingId, wanted);
    refresh();
    return result;
  });
}

export async function sendRemindersAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const wanted = reminderTarget.parse(input);
    await assertVerified(ctx.userId);
    await limit(ctx.weddingId);
    const result = await sendRsvpReminderEmails(ctx.weddingId, wanted);
    refresh();
    return result;
  });
}

// The form sends the days as text ("14, 3").
export async function saveReminderSettingsAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { enabled, days } = z
      .object({ enabled: z.boolean(), days: z.string().max(100) })
      .parse(input);
    const settings = reminderSettingsSchema.parse({ enabled, rsvpDays: parseDays(days) });
    // Turning on automatic emails to guests needs a confirmed address, like sending them by hand.
    if (settings.enabled) await assertVerified(ctx.userId);
    await setReminderSettings(ctx.weddingId, settings);
    refresh();
    return settings;
  });
}
