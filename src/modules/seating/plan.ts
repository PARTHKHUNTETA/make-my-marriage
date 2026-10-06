import { listEveryGuest } from "@/modules/guests/service";
import { buildPlan } from "./calc";
import type { SeatingParty, SeatingPlan } from "./schema";
import { listEventTables } from "./service";

// The seating plan for one event: its tables and every party invited to it. Kept apart from the
// seating service because it reads the guest list, and the guests module already calls the seating
// service when a guest is removed.
export async function getSeatingPlan(weddingId: string, eventId: string): Promise<SeatingPlan> {
  const [tables, guests] = await Promise.all([
    listEventTables(weddingId, eventId),
    listEveryGuest(weddingId, { eventId }),
  ]);
  const parties: SeatingParty[] = guests.flatMap((g) => {
    const invitation = g.invitations.find((i) => i.eventId === eventId);
    return invitation
      ? [
          {
            id: g.id,
            name: g.name,
            status: invitation.rsvpStatus,
            guestsAllowed: g.guestsAllowed,
            numberAttending: invitation.numberAttending,
          },
        ]
      : [];
  });
  return buildPlan(tables, parties);
}
