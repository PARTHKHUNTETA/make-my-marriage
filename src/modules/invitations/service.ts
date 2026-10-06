import { AppError } from "@/lib/errors";
import { eventStartsAt } from "@/modules/events/schema";
import { getEventsByIds } from "@/modules/events/service";
import type { RsvpInput } from "@/modules/guests/schema";
import { getGuestByToken, submitRsvp } from "@/modules/guests/service";
import { getWedding } from "@/modules/wedding/service";
import type { InvitationView } from "./schema";

// The guest-facing half of invitations (PRD 5.6, api-design §12). A token resolves to exactly one
// guest and exposes nothing beyond them. Anything unknown, or belonging to a deleted wedding,
// is the same friendly LINK_INVALID.

const INVALID = () => new AppError("LINK_INVALID", "This link is not valid any more.");

export async function getInvitation(
  token: string,
  now: Date = new Date(),
): Promise<InvitationView | null> {
  const found = await getGuestByToken(token);
  if (!found) return null;
  const { guest, weddingId } = found;
  const [wedding, events] = await Promise.all([
    getWedding(weddingId),
    getEventsByIds(
      weddingId,
      guest.invitations.map((i) => i.eventId),
    ),
  ]);
  if (!wedding) return null;
  const replies = new Map(guest.invitations.map((i) => [i.eventId, i]));
  return {
    couple: `${wedding.brideName} & ${wedding.groomName}`,
    weddingTitle: wedding.title,
    greeting: guest.guestsAllowed > 1 ? `Dear ${guest.name} & family` : `Dear ${guest.name}`,
    guestName: guest.name,
    guestsAllowed: guest.guestsAllowed,
    events: events.map((event) => {
      const reply = replies.get(event.id);
      return {
        eventId: event.id,
        name: event.name,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        venueName: event.venueName,
        address: event.address,
        dressCode: event.dressCode,
        description: event.description,
        status: reply?.rsvpStatus ?? "pending",
        numberAttending: reply?.numberAttending,
        locked: eventStartsAt(event).getTime() <= now.getTime(),
      };
    }),
  };
}

// Saves a guest's reply for one event, until that event starts. A guest cannot reset a reply to
// "no reply yet": that is for members only.
export async function submitGuestRsvp(
  token: string,
  input: RsvpInput,
  now: Date = new Date(),
): Promise<InvitationView> {
  const view = await getInvitation(token, now);
  if (!view) throw INVALID();
  const event = view.events.find((e) => e.eventId === input.eventId);
  if (!event) throw new AppError("NOT_INVITED", "This invitation is not for that event.");
  if (event.locked)
    throw new AppError(
      "RSVP_LOCKED",
      "This event has started, so replies are closed. Please contact the couple.",
    );
  if (input.status === "pending")
    throw new AppError("VALIDATION_FAILED", "Choose attending or not attending.");
  await submitRsvp(token, input.eventId, {
    status: input.status,
    numberAttending: input.numberAttending,
  });
  return (await getInvitation(token, now)) ?? Promise.reject(INVALID());
}
