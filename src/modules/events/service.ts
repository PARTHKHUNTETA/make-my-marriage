import { inTransaction } from "@/lib/db";
import { istDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { countGuestsInvitedToEvent, removeEventInvitations } from "@/modules/guests/service";
import { countExpensesForEvent, unlinkEventFromMoney } from "@/modules/money/service";
import { taskCountForEvent, unlinkEvent } from "@/modules/tasks/service";
import { countArrivalsForEvent, removeEventArrivals } from "@/modules/checkin/service";
import { removeEventAlbum } from "@/modules/photos/service";
import { countTablesForEvent, removeEventTables } from "@/modules/seating/service";
import { countVendorsForEvent, removeEventFromVendors } from "@/modules/vendors/service";
import {
  deleteEvent as removeEvent,
  findEvent,
  insertEvent,
  listEvents as findEvents,
  replaceEventFields,
  setShowTable,
  type EventDoc,
  type EventFields,
  type OptionalEventField,
} from "./repository";
import type { EventDeletePreview, EventInput, EventItem } from "./schema";

// Business rules for the events module (PRD 5.3, api-design §5).
//
// Not built yet because their modules come in later phases: creating an event's photo album
// (Phase 6), and on delete moving its photos to General (Phase 6). Each of those adds its own step to deleteEvent.

const NOT_FOUND = new AppError("NOT_FOUND", "That event no longer exists.");

function toItem(doc: EventDoc): EventItem {
  return {
    id: doc._id.toHexString(),
    type: doc.type,
    name: doc.name,
    date: doc.date,
    startTime: doc.startTime,
    endTime: doc.endTime,
    venueName: doc.venueName,
    address: doc.address,
    description: doc.description,
    dressCode: doc.dressCode,
    showOnWebsite: doc.showOnWebsite,
    showTable: doc.showTable ?? false,
  };
}

function toFields(input: EventInput): { set: EventFields; unset: OptionalEventField[] } {
  const date = istDate(input.date);
  if (!date) throw new AppError("VALIDATION_FAILED", "Enter a valid date");
  const set: EventFields = {
    type: input.type,
    name: input.name,
    date,
    startTime: input.startTime,
    showOnWebsite: input.showOnWebsite,
  };
  const unset: OptionalEventField[] = [];
  for (const key of ["endTime", "venueName", "address", "description", "dressCode"] as const) {
    if (input[key]) set[key] = input[key];
    else unset.push(key);
  }
  return { set, unset };
}

export async function listEvents(weddingId: string): Promise<EventItem[]> {
  return (await findEvents(weddingId)).map(toItem);
}

export async function getEvent(weddingId: string, eventId: string): Promise<EventItem | null> {
  const doc = await findEvent(weddingId, eventId);
  return doc ? toItem(doc) : null;
}

// The events with these ids that belong to this wedding, in date order. Unknown ids are ignored.
export async function getEventsByIds(weddingId: string, ids: string[]): Promise<EventItem[]> {
  const wanted = new Set(ids);
  return (await listEvents(weddingId)).filter((e) => wanted.has(e.id));
}

export async function eventExists(weddingId: string, eventId: string): Promise<boolean> {
  return (await findEvent(weddingId, eventId)) !== null;
}

export async function createEvent(weddingId: string, input: EventInput): Promise<EventItem> {
  return toItem(await insertEvent(weddingId, toFields(input).set));
}

export async function updateEvent(
  weddingId: string,
  eventId: string,
  input: EventInput,
): Promise<EventItem> {
  const { set, unset } = toFields(input);
  const doc = await replaceEventFields(weddingId, eventId, set, unset);
  if (!doc) throw NOT_FOUND;
  return toItem(doc);
}

// What would be affected, so the page can warn before the destructive call.
export async function previewEventDelete(
  weddingId: string,
  eventId: string,
): Promise<EventDeletePreview> {
  if (!(await eventExists(weddingId, eventId))) throw NOT_FOUND;
  const [taskCount, guestCount, expenseCount, vendorCount, tableCount, arrivalCount] =
    await Promise.all([
      taskCountForEvent(weddingId, eventId),
      countGuestsInvitedToEvent(weddingId, eventId),
      countExpensesForEvent(weddingId, eventId),
      countVendorsForEvent(weddingId, eventId),
      countTablesForEvent(weddingId, eventId),
      countArrivalsForEvent(weddingId, eventId),
    ]);
  return { taskCount, guestCount, expenseCount, vendorCount, tableCount, arrivalCount };
}

// One transaction: the event goes with its invitations and RSVPs; its tasks and expenses lose the
// link but stay, its budget line goes with it, vendors stop listing it, and its seating tables go.
export async function deleteEvent(weddingId: string, eventId: string): Promise<void> {
  await inTransaction(async (session) => {
    if (!(await removeEvent(weddingId, eventId, { session }))) throw NOT_FOUND;
    await removeEventInvitations(weddingId, eventId, { session });
    await unlinkEvent(weddingId, eventId, { session });
    await unlinkEventFromMoney(weddingId, eventId, { session });
    await removeEventFromVendors(weddingId, eventId, { session });
    await removeEventTables(weddingId, eventId, { session });
    await removeEventArrivals(weddingId, eventId, { session });
    await removeEventAlbum(weddingId, eventId, { session });
  });
}

// Turns "Your table" on the guests' invitation pages on or off for this event.
export async function setEventShowTable(
  weddingId: string,
  eventId: string,
  on: boolean,
): Promise<void> {
  if (!(await setShowTable(weddingId, eventId, on))) throw NOT_FOUND;
}
