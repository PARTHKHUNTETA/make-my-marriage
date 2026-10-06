"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { getEventsByIds, listEvents } from "@/modules/events/service";
import { setWhatsappMessage } from "@/modules/wedding/service";
import { buildPreview, parseImportTable, rowsToImport, summarize } from "./import";
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
  createGuests,
  deleteGuest,
  findPhoneDuplicate,
  overrideRsvp,
  phonesInUse,
  recordWhatsappShare,
  updateGuest,
} from "./service";
import { MAX_IMPORT_ROWS } from "./import";
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

// ---- bulk import (PRD 5.5): preview first, then confirm ----

// The file is read in the browser; only its cells come here. Everything is checked again on the
// server, on every call, because the browser is not trusted.
const importSchema = z.object({
  table: z
    .array(z.array(z.string().max(500)).max(30))
    .min(1, "The file is empty.")
    .max(MAX_IMPORT_ROWS + 1, `Import up to ${MAX_IMPORT_ROWS} guests at a time.`),
  includeDuplicates: z.boolean().default(false),
});

async function previewFor(weddingId: string, table: string[][]) {
  const parsed = parseImportTable(table);
  if (parsed.problem) throw new AppError("VALIDATION_FAILED", parsed.problem);
  const events = (await listEvents(weddingId)).map((e) => ({ id: e.id, name: e.name }));
  if (events.length === 0)
    throw new AppError("VALIDATION_FAILED", "Add your events first. Guests are invited to events.");
  const phones = parsed.rows.flatMap((r) => normalizePhone(r.phone) ?? []);
  return buildPreview(parsed.rows, events, await phonesInUse(weddingId, phones));
}

export async function previewGuestImportAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { table } = importSchema.parse(input);
    const rows = await previewFor(ctx.weddingId, table);
    return {
      // The parsed guest stays on the server; the browser only needs what to show.
      rows: rows.map((row) => ({ ...row, input: undefined })),
      summary: summarize(rows),
    };
  });
}

export async function confirmGuestImportAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { table, includeDuplicates } = importSchema.parse(input);
    const rows = await previewFor(ctx.weddingId, table);
    const toCreate = rowsToImport(rows, includeDuplicates);
    if (toCreate.length === 0)
      throw new AppError("VALIDATION_FAILED", "There are no valid guests to import.");
    const imported = await createGuests(ctx.weddingId, toCreate);
    refresh();
    return { imported, skipped: rows.length - imported };
  });
}
