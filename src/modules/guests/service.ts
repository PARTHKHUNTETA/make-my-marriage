import { ObjectId, type ClientSession } from "mongodb";
import { AppError } from "@/lib/errors";
import { removePartySeats } from "@/modules/seating/service";
import { generateToken } from "@/lib/tokens";
import {
  replyOverview,
  applyRsvpByToken,
  applyRsvpForGuest,
  countInvitedToEvent,
  deleteGuest as removeGuest,
  findGuest,
  findGuestByEntryToken,
  findGuestByPhone,
  findGuestByToken,
  findGuestsByIds,
  findGuestsByPhones,
  guestStats,
  insertGuest,
  insertGuests,
  listAllGuests,
  markInviteEmailed,
  markWhatsappShared,
  pullEventInvitations,
  searchGuests,
  setRemindersUnsubscribed,
  updateGuest as saveGuest,
  type GuestDoc,
  type GuestFields,
  type InvitationDoc,
  type OptionalGuestField,
} from "./repository";
import {
  GUEST_PAGE_SIZE,
  type GuestInput,
  type GuestItem,
  type GuestQuery,
  type GuestStats,
  type RsvpStatus,
} from "./schema";

// Business rules for the guests module (PRD 5.5, 5.6; api-design §6). The caller (a Server
// Action) has already checked that the events in `invitedEventIds` belong to this wedding.

const NOT_FOUND = new AppError("NOT_FOUND", "That guest no longer exists.");

export function toItem(doc: GuestDoc): GuestItem {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    guestsAllowed: doc.guestsAllowed,
    notes: doc.notes,
    token: doc.token,
    invitations: doc.invitations.map((i) => ({
      eventId: i.eventId.toHexString(),
      rsvpStatus: i.rsvpStatus,
      numberAttending: i.numberAttending,
      respondedAt: i.respondedAt,
    })),
    remindersUnsubscribed: doc.remindersUnsubscribed,
    inviteEmailedAt: doc.inviteEmailedAt,
    whatsappSharedAt: doc.whatsappSharedAt,
  };
}

function split(input: GuestInput): { set: GuestFields; unset: OptionalGuestField[] } {
  const set: GuestFields = { name: input.name, guestsAllowed: input.guestsAllowed };
  const unset: OptionalGuestField[] = [];
  for (const key of ["phone", "email", "notes"] as const) {
    if (input[key]) set[key] = input[key];
    else unset.push(key);
  }
  return { set, unset };
}

const unique = (ids: string[]) => [...new Set(ids)];

// A fresh pending invitation per event, each with its own unguessable entry token.
const freshInvitation = (eventId: string): InvitationDoc => ({
  eventId: new ObjectId(eventId),
  rsvpStatus: "pending",
  entryToken: generateToken(),
});

export function newGuestDoc(input: GuestInput) {
  return {
    ...split(input).set,
    token: generateToken(),
    invitations: unique(input.invitedEventIds).map(freshInvitation),
    remindersUnsubscribed: false,
  };
}

export async function createGuest(weddingId: string, input: GuestInput): Promise<GuestItem> {
  return toItem(await insertGuest(weddingId, newGuestDoc(input)));
}

// Saves many already-validated guests at once (CSV import). Returns how many were created.
export async function createGuests(weddingId: string, inputs: GuestInput[]): Promise<number> {
  return insertGuests(weddingId, inputs.map(newGuestDoc));
}

export async function updateGuest(
  weddingId: string,
  guestId: string,
  input: GuestInput,
): Promise<GuestItem> {
  const { set, unset } = split(input);
  const eventIds = unique(input.invitedEventIds);
  const before = await findGuest(weddingId, guestId);
  const doc = await saveGuest(
    weddingId,
    guestId,
    set,
    unset,
    eventIds,
    eventIds.map((eventId) => ({ eventId, entryToken: generateToken() })),
  );
  if (!doc) throw NOT_FOUND;
  // A party taken off an event gives up its seats there.
  const dropped = (before?.invitations ?? [])
    .map((i) => i.eventId.toHexString())
    .filter((e) => !eventIds.includes(e));
  if (dropped.length > 0) await removePartySeats(weddingId, guestId, dropped);
  return toItem(doc);
}

export async function getGuest(weddingId: string, guestId: string): Promise<GuestItem | null> {
  const doc = await findGuest(weddingId, guestId);
  return doc ? toItem(doc) : null;
}

export async function deleteGuest(weddingId: string, guestId: string): Promise<void> {
  if (!(await removeGuest(weddingId, guestId))) throw NOT_FOUND;
  await removePartySeats(weddingId, guestId, "all");
}

export async function listGuests(
  weddingId: string,
  query: GuestQuery,
): Promise<{ items: GuestItem[]; total: number; page: number; pageSize: number }> {
  const { docs, total } = await searchGuests(weddingId, {
    search: query.search,
    eventId: query.eventId,
    status: query.status,
    skip: (query.page - 1) * GUEST_PAGE_SIZE,
    limit: GUEST_PAGE_SIZE,
  });
  return { items: docs.map(toItem), total, page: query.page, pageSize: GUEST_PAGE_SIZE };
}

export async function listEveryGuest(
  weddingId: string,
  filter: { eventId?: string; status?: RsvpStatus } = {},
): Promise<GuestItem[]> {
  return (await listAllGuests(weddingId, filter)).map(toItem);
}

// The name of another guest using this phone number, if any (PRD 5.5 duplicate warning).
export async function findPhoneDuplicate(
  weddingId: string,
  phone: string,
  excludeGuestId?: string,
): Promise<string | null> {
  return (await findGuestByPhone(weddingId, phone, excludeGuestId))?.name ?? null;
}

// For the import preview: which of these numbers already belong to a guest, and whose.
export async function phonesInUse(
  weddingId: string,
  phones: string[],
): Promise<Map<string, string>> {
  const found = await findGuestsByPhones(weddingId, unique(phones));
  return new Map(found.flatMap((g) => (g.phone ? [[g.phone, g.name] as const] : [])));
}

export async function recordWhatsappShare(weddingId: string, guestId: string): Promise<void> {
  await markWhatsappShared(weddingId, guestId);
}

export async function getStats(weddingId: string): Promise<GuestStats> {
  const row = await guestStats(weddingId);
  const overall = row.overall[0] ?? { parties: 0, responded: 0, pending: 0, headcount: 0 };
  return {
    ...overall,
    perEvent: row.perEvent.map((e) => ({
      eventId: e._id.toHexString(),
      invited: e.invited,
      attending: e.attending,
      notAttending: e.notAttending,
      pending: e.pending,
      headcount: e.headcount,
    })),
  };
}

export function countGuestsInvitedToEvent(weddingId: string, eventId: string): Promise<number> {
  return countInvitedToEvent(weddingId, eventId);
}

// Called by the events module inside its delete transaction.
export function removeEventInvitations(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<number> {
  return pullEventInvitations(weddingId, eventId, options);
}

// ---- RSVP ----

export type RsvpWrite = { status: RsvpStatus; numberAttending?: number };

// Why an RSVP write matched nothing: the link, the event or the headcount.
async function explainRsvpFailure(
  doc: GuestDoc | null,
  eventId: string,
  write: RsvpWrite,
): Promise<AppError> {
  if (!doc) return new AppError("LINK_INVALID", "This link is not valid any more.");
  if (!doc.invitations.some((i) => i.eventId.toHexString() === eventId))
    return new AppError("NOT_INVITED", "This invitation is not for that event.");
  if (write.status === "attending" && (write.numberAttending ?? 0) > doc.guestsAllowed)
    return new AppError(
      "RSVP_OVER_LIMIT",
      `Your invitation is for up to ${doc.guestsAllowed} ${doc.guestsAllowed === 1 ? "person" : "people"}.`,
    );
  return new AppError("INTERNAL", "We couldn't save your reply. Please try again.");
}

const clean = (write: RsvpWrite): RsvpWrite =>
  write.status === "attending" ? write : { status: write.status };

// A guest's reply through their own link. The caller has already checked the event has not
// started. Replacing an earlier reply is the normal case, never a duplicate.
export async function submitRsvp(
  token: string,
  eventId: string,
  write: RsvpWrite,
): Promise<GuestItem> {
  const updated = await applyRsvpByToken(token, eventId, clean(write));
  if (!updated) throw await explainRsvpFailure(await findGuestByToken(token), eventId, write);
  return toItem(updated);
}

// A member changing a reply on the guest's behalf. Allowed at any time, even after the event.
export async function overrideRsvp(
  weddingId: string,
  guestId: string,
  eventId: string,
  write: RsvpWrite,
): Promise<GuestItem> {
  const updated = await applyRsvpForGuest(weddingId, guestId, eventId, clean(write));
  if (!updated) throw await explainRsvpFailure(await findGuest(weddingId, guestId), eventId, write);
  return toItem(updated);
}

// Resolves a link to its guest and wedding (for the invitation page). Null when unknown.
export async function getGuestByToken(
  token: string,
): Promise<{ guest: GuestItem; weddingId: string } | null> {
  const doc = await findGuestByToken(token);
  return doc ? { guest: toItem(doc), weddingId: doc.weddingId.toHexString() } : null;
}

export async function getGuestsByIds(weddingId: string, ids: string[]): Promise<GuestItem[]> {
  return (await findGuestsByIds(weddingId, unique(ids))).map(toItem);
}

export function recordInviteEmailed(weddingId: string, guestIds: string[]): Promise<void> {
  return markInviteEmailed(weddingId, guestIds);
}

// A guest's own choice, from the link in a reminder email. False when the link is unknown.
export function setGuestUnsubscribed(token: string, unsubscribed: boolean): Promise<boolean> {
  return setRemindersUnsubscribed(token, unsubscribed);
}

// What a scanned entry QR stands for: the party, and the one invitation (event) the code is for.
export async function resolveEntry(
  weddingId: string,
  entryToken: string,
): Promise<{ guest: GuestItem; eventId: string } | null> {
  const doc = await findGuestByEntryToken(weddingId, entryToken);
  const invitation = doc?.invitations.find((i) => i.entryToken === entryToken);
  return doc && invitation
    ? { guest: toItem(doc), eventId: invitation.eventId.toHexString() }
    : null;
}

// The entry code for a guest's own invitation, found from their personal link. Only for a party
// that has said it is coming; anyone else gets nothing.
export async function getEntryTokenForGuest(
  guestToken: string,
  eventId: string,
): Promise<string | null> {
  const doc = await findGuestByToken(guestToken);
  const invitation = doc?.invitations.find((i) => i.eventId.toHexString() === eventId);
  return invitation && invitation.rsvpStatus === "attending" ? invitation.entryToken : null;
}

export type { ReplyOverview } from "./repository";

// The reply figures on the dashboard: parties coming, parties who declined, and the latest answers.
export function getReplyOverview(weddingId: string, recentLimit = 5) {
  return replyOverview(weddingId, recentLimit);
}
