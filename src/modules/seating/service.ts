import type { ClientSession } from "mongodb";
import { inTransaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  changeTable,
  countTables,
  deleteTable,
  deleteTablesForEvent,
  findTable,
  insertTable,
  listTablesForEvent,
  placeParty,
  removeParty,
  removePartyFromEvents,
  tablesOfParty,
  type TableDoc,
} from "./repository";
import type { TableItem } from "./schema";

// Business rules for the seating module (PRD 5.13, api-design §9). The caller (a Server Action)
// has already checked that the event and the party belong to this wedding and that the party is
// invited and coming.

const NOT_FOUND = new AppError("NOT_FOUND", "That table no longer exists.");
const NAME_TAKEN = new AppError(
  "VALIDATION_FAILED",
  "This event already has a table with that name.",
  {
    name: ["This event already has a table with that name."],
  },
);
const FULL = (name: string, free: number) =>
  new AppError(
    "TABLE_FULL",
    free > 0
      ? `${name} only has ${free} ${free === 1 ? "seat" : "seats"} free.`
      : `${name} is full.`,
  );

export function toItem(doc: TableDoc): TableItem {
  return {
    id: doc._id.toHexString(),
    eventId: doc.eventId.toHexString(),
    name: doc.name,
    capacity: doc.capacity,
    assignments: doc.assignments.map((a) => ({ guestId: a.guestId.toHexString(), seats: a.seats })),
  };
}

export async function addTable(
  weddingId: string,
  input: { eventId: string; name: string; capacity: number },
): Promise<TableItem> {
  const doc = await insertTable(weddingId, input);
  if (!doc) throw NAME_TAKEN;
  return toItem(doc);
}

export async function editTable(
  weddingId: string,
  tableId: string,
  input: { name: string; capacity: number },
): Promise<TableItem> {
  const result = await changeTable(weddingId, tableId, input);
  if (result === "taken") throw NAME_TAKEN;
  if (!result) throw NOT_FOUND;
  return toItem(result);
}

export async function removeTable(weddingId: string, tableId: string): Promise<void> {
  if (!(await deleteTable(weddingId, tableId))) throw NOT_FOUND;
}

export async function getTable(weddingId: string, tableId: string): Promise<TableItem | null> {
  const doc = await findTable(weddingId, tableId);
  return doc ? toItem(doc) : null;
}

export async function listEventTables(weddingId: string, eventId: string): Promise<TableItem[]> {
  return (await listTablesForEvent(weddingId, eventId)).map(toItem);
}

// Puts a party at a table (or changes its seats there). Refused with TABLE_FULL when the seats
// would not fit, checked in the same write as the change.
export async function assignParty(
  weddingId: string,
  tableId: string,
  guestId: string,
  seats: number,
): Promise<void> {
  const result = await placeParty(weddingId, tableId, guestId, seats);
  if (result === "ok") return;
  const table = await findTable(weddingId, tableId);
  if (!table) throw NOT_FOUND;
  const others = table.assignments
    .filter((a) => a.guestId.toHexString() !== guestId)
    .reduce((sum, a) => sum + a.seats, 0);
  throw FULL(table.name, Math.max(0, table.capacity - others));
}

export async function unassignParty(
  weddingId: string,
  tableId: string,
  guestId: string,
): Promise<void> {
  if (!(await removeParty(weddingId, tableId, guestId)))
    throw new AppError("NOT_FOUND", "That party is not at this table.");
}

// Moves a party from one table to another all in one go: if the new table is full, the party
// stays where it was.
export async function moveParty(
  weddingId: string,
  input: { guestId: string; fromTableId: string; toTableId: string; seats: number },
): Promise<void> {
  await inTransaction(async (session: ClientSession) => {
    if (!(await removeParty(weddingId, input.fromTableId, input.guestId, { session })))
      throw new AppError("NOT_FOUND", "That party is no longer at that table.");
    const result = await placeParty(weddingId, input.toTableId, input.guestId, input.seats, {
      session,
    });
    if (result === "ok") return;
    const table = await findTable(weddingId, input.toTableId);
    if (!table) throw NOT_FOUND;
    const taken = table.assignments
      .filter((a) => a.guestId.toHexString() !== input.guestId)
      .reduce((sum, a) => sum + a.seats, 0);
    throw FULL(table.name, Math.max(0, table.capacity - taken));
  });
}

export function countTablesForEvent(weddingId: string, eventId: string): Promise<number> {
  return countTables(weddingId, eventId);
}

// Called by the events module inside its delete transaction.
export function removeEventTables(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<void> {
  return deleteTablesForEvent(weddingId, eventId, options);
}

// Called by the guests module when a guest is deleted or taken off events.
export function removePartySeats(
  weddingId: string,
  guestId: string,
  eventIds: string[] | "all",
): Promise<void> {
  return removePartyFromEvents(weddingId, guestId, eventIds);
}

// The table names a party sits at, by event, for the guest's invitation page.
export async function tableNamesForParty(
  weddingId: string,
  guestId: string,
): Promise<Map<string, string[]>> {
  const byEvent = new Map<string, string[]>();
  for (const table of await tablesOfParty(weddingId, guestId)) {
    const event = table.eventId.toHexString();
    byEvent.set(event, [...(byEvent.get(event) ?? []), table.name]);
  }
  return byEvent;
}
