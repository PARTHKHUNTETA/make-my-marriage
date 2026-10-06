"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { getEvent, setEventShowTable } from "@/modules/events/service";
import { getGuest } from "@/modules/guests/service";
import { seatNeed } from "./calc";
import {
  assignSchema,
  moveSchema,
  showTableSchema,
  tableChangeSchema,
  tableIdSchema,
  tableInputSchema,
  unassignSchema,
} from "./schema";
import {
  addTable,
  assignParty,
  editTable,
  getTable,
  listEventTables,
  moveParty,
  removeTable,
  unassignParty,
} from "./service";

// Server Actions for seating. Open to Admins and Managers. The wedding always comes from the
// signed-in member. A party can only be seated at an event it is invited to and coming to, and
// never given more seats than it needs in all.

const refresh = () => revalidatePath("/", "layout");

// Checks the party for this table's event and returns how many seats it needs and how many it
// already has at other tables of the event.
async function checkParty(
  weddingId: string,
  tableEventId: string,
  guestId: string,
  ignoreTables: string[],
) {
  const guest = await getGuest(weddingId, guestId);
  if (!guest) throw new AppError("NOT_FOUND", "That guest no longer exists.");
  const invitation = guest.invitations.find((i) => i.eventId === tableEventId);
  if (!invitation) throw new AppError("NOT_INVITED", `${guest.name} is not invited to this event.`);
  if (invitation.rsvpStatus === "not_attending")
    throw new AppError("VALIDATION_FAILED", `${guest.name} is not coming to this event.`);
  const need = seatNeed({
    status: invitation.rsvpStatus,
    guestsAllowed: guest.guestsAllowed,
    numberAttending: invitation.numberAttending,
  });
  const tables = await listEventTables(weddingId, tableEventId);
  const elsewhere = tables
    .filter((t) => !ignoreTables.includes(t.id))
    .flatMap((t) => t.assignments)
    .filter((a) => a.guestId === guestId)
    .reduce((sum, a) => sum + a.seats, 0);
  return { guest, need, elsewhere };
}

function tooMany(name: string, need: number, elsewhere: number) {
  const left = Math.max(0, need - elsewhere);
  return new AppError(
    "VALIDATION_FAILED",
    left === 0
      ? `${name} already has all ${need} seats.`
      : `${name} needs ${need} ${need === 1 ? "seat" : "seats"} in all; only ${left} left to place.`,
    { seats: [`Only ${left} left to place`] },
  );
}

export async function createTableAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const parsed = tableInputSchema.parse(input);
    if (!(await getEvent(ctx.weddingId, parsed.eventId)))
      throw new AppError("NOT_FOUND", "That event no longer exists.");
    const table = await addTable(ctx.weddingId, parsed);
    refresh();
    return { id: table.id };
  });
}

export async function updateTableAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { tableId, name, capacity } = tableChangeSchema.parse(input);
    await editTable(ctx.weddingId, tableId, { name, capacity });
    refresh();
    return {};
  });
}

export async function deleteTableAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await removeTable(ctx.weddingId, tableIdSchema.parse(input).tableId);
    refresh();
    return {};
  });
}

export async function assignPartyAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { tableId, guestId, seats } = assignSchema.parse(input);
    const table = await getTable(ctx.weddingId, tableId);
    if (!table) throw new AppError("NOT_FOUND", "That table no longer exists.");
    const { guest, need, elsewhere } = await checkParty(ctx.weddingId, table.eventId, guestId, [
      tableId,
    ]);
    if (seats + elsewhere > need) throw tooMany(guest.name, need, elsewhere);
    await assignParty(ctx.weddingId, tableId, guestId, seats);
    refresh();
    return {};
  });
}

export async function moveSeatedPartyAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { guestId, fromTableId, toTableId, seats } = moveSchema.parse(input);
    const [from, to] = await Promise.all([
      getTable(ctx.weddingId, fromTableId),
      getTable(ctx.weddingId, toTableId),
    ]);
    if (!from || !to) throw new AppError("NOT_FOUND", "That table no longer exists.");
    if (from.eventId !== to.eventId)
      throw new AppError(
        "VALIDATION_FAILED",
        "A party can only move between tables of the same event.",
      );
    const held = from.assignments.find((a) => a.guestId === guestId)?.seats;
    if (held === undefined)
      throw new AppError("NOT_FOUND", "That party is no longer at that table.");
    const wanted = seats ?? held;
    const { guest, need, elsewhere } = await checkParty(ctx.weddingId, to.eventId, guestId, [
      fromTableId,
      toTableId,
    ]);
    if (wanted + elsewhere > need) throw tooMany(guest.name, need, elsewhere);
    await moveParty(ctx.weddingId, { guestId, fromTableId, toTableId, seats: wanted });
    refresh();
    return {};
  });
}

export async function unassignPartyAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { tableId, guestId } = unassignSchema.parse(input);
    await unassignParty(ctx.weddingId, tableId, guestId);
    refresh();
    return {};
  });
}

// "Your table" on the guests' invitation pages, per event. Off until switched on.
export async function setShowTableAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { eventId, on } = showTableSchema.parse(input);
    await setEventShowTable(ctx.weddingId, eventId, on);
    refresh();
    return {};
  });
}
