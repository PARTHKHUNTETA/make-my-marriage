import type { ClientSession } from "mongodb";
import { AppError } from "@/lib/errors";
import { getEvent } from "@/modules/events/service";
import { getGuest, getStats, listGuests, resolveEntry } from "@/modules/guests/service";
import { seatNeed } from "@/modules/seating/calc";
import { tableNamesForParty } from "@/modules/seating/service";
import {
  arrivalTotals,
  countArrivals,
  deleteArrivalsForEvent,
  findArrival,
  findArrivals,
  recordArrival,
  type CheckInDoc,
} from "./repository";
import type { CheckInOutcome, CheckInRecord, Counter, EntryLookup, PartyMatch } from "./schema";

// Business rules for check-in at the venue (PRD 5.14, api-design §9). Every action here is for a
// signed-in member of the wedding, and every record is idempotent: scanning the same party twice,
// or replaying a queued scan, never counts anyone twice.

function toRecord(doc: CheckInDoc): CheckInRecord {
  return {
    id: doc._id.toHexString(),
    guestId: doc.guestId?.toHexString(),
    walkInName: doc.walkInName,
    arrivedCount: doc.arrivedCount,
    checkedInAt: doc.checkedInAt,
    walkIn: doc.walkIn === true,
  };
}

async function requireEvent(weddingId: string, eventId: string) {
  const event = await getEvent(weddingId, eventId);
  if (!event) throw new AppError("NOT_FOUND", "That event no longer exists.");
  return event;
}

// What a scanned code means at this event.
export async function lookupEntry(
  weddingId: string,
  eventId: string,
  entryToken: string,
): Promise<EntryLookup> {
  await requireEvent(weddingId, eventId);
  const found = await resolveEntry(weddingId, entryToken);
  if (!found) return { kind: "unknown" };
  const { guest } = found;
  // A real code, but for a different event than the one being checked in.
  if (found.eventId !== eventId)
    return { kind: "not_on_list", guestId: guest.id, name: guest.name };
  const invitation = guest.invitations.find((i) => i.eventId === eventId)!;
  const [arrival, tables] = await Promise.all([
    findArrival(weddingId, eventId, guest.id),
    tableNamesForParty(weddingId, guest.id),
  ]);
  return {
    kind: "party",
    guestId: guest.id,
    name: guest.name,
    status: invitation.rsvpStatus,
    numberAttending: invitation.numberAttending,
    guestsAllowed: guest.guestsAllowed,
    notes: guest.notes,
    table: tables.get(eventId)?.join(", "),
    checkedIn: arrival ? { at: arrival.checkedInAt, count: arrival.arrivedCount } : undefined,
  };
}

// Finds parties by name or phone, for guests who do not have their code. Parties not invited to
// this event are included, marked as such, so the gate can admit them as walk-ins.
export async function searchParties(
  weddingId: string,
  eventId: string,
  query: string,
): Promise<PartyMatch[]> {
  await requireEvent(weddingId, eventId);
  const { items } = await listGuests(weddingId, { search: query, page: 1 });
  const matches = items.slice(0, 20);
  const arrivals = new Map(
    (
      await findArrivals(
        weddingId,
        eventId,
        matches.map((g) => g.id),
      )
    ).map((a) => [a.guestId!.toHexString(), a]),
  );
  return matches.map((g) => {
    const invitation = g.invitations.find((i) => i.eventId === eventId);
    const arrival = arrivals.get(g.id);
    return {
      guestId: g.id,
      name: g.name,
      phone: g.phone,
      invited: Boolean(invitation),
      status: invitation?.rsvpStatus,
      numberAttending: invitation?.numberAttending,
      guestsAllowed: g.guestsAllowed,
      checkedIn: arrival ? { at: arrival.checkedInAt, count: arrival.arrivedCount } : undefined,
    };
  });
}

// Records a party's arrival. If they are already checked in, nothing changes and the earlier
// record comes back (so the gate can say "Already checked in at 7:42 PM, 3 people").
export async function checkInParty(
  weddingId: string,
  memberId: string,
  input: { eventId: string; guestId: string; arrivedCount: number; clientKey: string },
): Promise<CheckInOutcome> {
  await requireEvent(weddingId, input.eventId);
  const guest = await getGuest(weddingId, input.guestId);
  if (!guest) throw new AppError("NOT_FOUND", "That party no longer exists.");
  const invited = guest.invitations.some((i) => i.eventId === input.eventId);
  const { doc, created } = await recordArrival(weddingId, { ...input, memberId, walkIn: !invited });
  return { status: created ? "checked_in" : "already", record: toRecord(doc) };
}

// Admits someone who is not on the list. They may be a known party not invited to this event, or
// a stranger known only by name.
export async function admitWalkIn(
  weddingId: string,
  memberId: string,
  input: {
    eventId: string;
    name: string;
    arrivedCount: number;
    guestId?: string;
    clientKey: string;
  },
): Promise<CheckInOutcome> {
  await requireEvent(weddingId, input.eventId);
  if (input.guestId && !(await getGuest(weddingId, input.guestId)))
    throw new AppError("NOT_FOUND", "That party no longer exists.");
  const { doc, created } = await recordArrival(weddingId, {
    eventId: input.eventId,
    guestId: input.guestId,
    walkInName: input.guestId ? undefined : input.name,
    walkIn: true,
    arrivedCount: input.arrivedCount,
    memberId,
    clientKey: input.clientKey,
  });
  return { status: created ? "checked_in" : "already", record: toRecord(doc) };
}

export type SyncResult = {
  clientKey: string;
  outcome: "checked_in" | "already" | "not_on_list" | "unknown" | "error";
  name?: string;
  count?: number;
};

// Scans made with no signal, sent in one batch when the phone is back online. Each is handled on
// its own, in order, and replaying any of them is harmless.
export async function syncScans(
  weddingId: string,
  memberId: string,
  eventId: string,
  scans: Array<{ entryToken: string; clientKey: string; arrivedCount?: number }>,
): Promise<SyncResult[]> {
  await requireEvent(weddingId, eventId);
  const results: SyncResult[] = [];
  for (const scan of scans) {
    try {
      const found = await resolveEntry(weddingId, scan.entryToken);
      if (!found) {
        results.push({ clientKey: scan.clientKey, outcome: "unknown" });
        continue;
      }
      const { guest } = found;
      if (found.eventId !== eventId) {
        results.push({ clientKey: scan.clientKey, outcome: "not_on_list", name: guest.name });
        continue;
      }
      const invitation = guest.invitations.find((i) => i.eventId === eventId)!;
      const count =
        scan.arrivedCount ??
        Math.max(
          1,
          seatNeed({
            status: invitation.rsvpStatus,
            guestsAllowed: guest.guestsAllowed,
            numberAttending: invitation.numberAttending,
          }),
        );
      const { doc, created } = await recordArrival(weddingId, {
        eventId,
        guestId: guest.id,
        arrivedCount: count,
        memberId,
        clientKey: scan.clientKey,
      });
      results.push({
        clientKey: scan.clientKey,
        outcome: created ? "checked_in" : "already",
        name: guest.name,
        count: doc.arrivedCount,
      });
    } catch {
      results.push({ clientKey: scan.clientKey, outcome: "error" });
    }
  }
  return results;
}

// Arrived against expected, for the counter at the gate. Expected is the number of people who have
// said they are coming; arrived counts everyone checked in, walk-ins included.
export async function getCounter(weddingId: string, eventId: string): Promise<Counter> {
  await requireEvent(weddingId, eventId);
  const [totals, stats] = await Promise.all([
    arrivalTotals(weddingId, eventId),
    getStats(weddingId),
  ]);
  const event = stats.perEvent.find((e) => e.eventId === eventId);
  return {
    arrived: totals.people,
    arrivedParties: totals.parties,
    expected: event?.headcount ?? 0,
  };
}

export function countArrivalsForEvent(weddingId: string, eventId: string): Promise<number> {
  return countArrivals(weddingId, eventId);
}

// Called by the events module inside its delete transaction.
export function removeEventArrivals(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<void> {
  return deleteArrivalsForEvent(weddingId, eventId, options);
}
