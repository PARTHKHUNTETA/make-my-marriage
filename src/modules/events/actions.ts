"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { eventIdSchema, eventInputSchema } from "./schema";
import { createEvent, deleteEvent, previewEventDelete, updateEvent } from "./service";

// Server Actions for events. Open to Admins and Managers. The wedding always comes from the
// signed-in member, never from the input.

function refresh() {
  // Events appear on the events list, the detail page, the task forms and the dashboard.
  revalidatePath("/", "layout");
}

export async function createEventAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const event = await createEvent(ctx.weddingId, eventInputSchema.parse(input));
    refresh();
    return { id: event.id };
  });
}

export async function updateEventAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { eventId, ...fields } = (input ?? {}) as { eventId?: unknown };
    const id = eventIdSchema.parse({ eventId }).eventId;
    await updateEvent(ctx.weddingId, id, eventInputSchema.parse(fields));
    refresh();
    return {};
  });
}

export async function previewEventDeleteAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    return previewEventDelete(ctx.weddingId, eventIdSchema.parse(input).eventId);
  });
}

export async function deleteEventAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await deleteEvent(ctx.weddingId, eventIdSchema.parse(input).eventId);
    refresh();
    return {};
  });
}
