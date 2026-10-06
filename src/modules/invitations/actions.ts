"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
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
    await setReminderSettings(ctx.weddingId, settings);
    refresh();
    return settings;
  });
}
