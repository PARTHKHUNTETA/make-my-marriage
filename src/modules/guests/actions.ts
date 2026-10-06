"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { getEventsByIds } from "@/modules/events/service";
import { setWhatsappMessage } from "@/modules/wedding/service";
import {
  guestIdSchema,
  guestInputSchema,
  memberRsvpSchema,
  normalizePhone,
  phoneCheckSchema,
  type GuestInput,
} from "./schema";
import {
  createGuest,
  deleteGuest,
  findPhoneDuplicate,
  overrideRsvp,
  recordWhatsappShare,
  updateGuest,
} from "./service";
import { WHATSAPP_MESSAGE_MAX } from "./whatsapp";

// Server Actions for the guest list. Open to Admins and Managers. The wedding always comes from
// the signed-in member. A guest may only be invited to events of the same wedding, which is
// checked here because this module does not reach into the events module's data.

async function checkEvents(weddingId: string, input: GuestInput) {
  const found = await getEventsByIds(weddingId, input.invitedEventIds);
  if (found.length !== new Set(input.invitedEventIds).size)
    throw new AppError("VALIDATION_FAILED", "One of those events no longer exists.", {
      invitedEventIds: ["Choose from the events in the list"],
    });
}

const refresh = () => revalidatePath("/", "layout");

export async function createGuestAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const parsed = guestInputSchema.parse(input);
    await checkEvents(ctx.weddingId, parsed);
    const guest = await createGuest(ctx.weddingId, parsed);
    refresh();
    return { id: guest.id };
  });
}

export async function updateGuestAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { guestId, ...fields } = (input ?? {}) as { guestId?: unknown };
    const id = guestIdSchema.parse({ guestId }).guestId;
    const parsed = guestInputSchema.parse(fields);
    await checkEvents(ctx.weddingId, parsed);
    await updateGuest(ctx.weddingId, id, parsed);
    refresh();
    return {};
  });
}

export async function deleteGuestAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await deleteGuest(ctx.weddingId, guestIdSchema.parse(input).guestId);
    refresh();
    return {};
  });
}

// For the warning under the phone field while typing (PRD 5.5): not an error, just a heads-up.
export async function checkPhoneAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { phone, excludeGuestId } = phoneCheckSchema.parse(input);
    const normalized = normalizePhone(phone);
    const duplicateOf = normalized
      ? await findPhoneDuplicate(ctx.weddingId, normalized, excludeGuestId)
      : null;
    return { duplicateOf };
  });
}

// Tapping "Share on WhatsApp" records it; delivery cannot be confirmed (PRD 5.6).
export async function recordWhatsappShareAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await recordWhatsappShare(ctx.weddingId, guestIdSchema.parse(input).guestId);
    refresh();
    return {};
  });
}

export async function overrideRsvpAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { guestId, eventId, status, numberAttending } = memberRsvpSchema.parse(input);
    await overrideRsvp(ctx.weddingId, guestId, eventId, { status, numberAttending });
    refresh();
    return {};
  });
}

const whatsappSchema = z.object({
  message: z.string().max(WHATSAPP_MESSAGE_MAX, `Keep it under ${WHATSAPP_MESSAGE_MAX} characters`),
});

export async function saveWhatsappMessageAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await setWhatsappMessage(ctx.weddingId, whatsappSchema.parse(input).message);
    refresh();
    return {};
  });
}
