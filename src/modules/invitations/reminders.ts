import { daysUntil } from "@/lib/dates";
import type { RsvpStatus } from "@/modules/guests/schema";

// Who gets which automatic reminder today (PRD 5.6). Pure, so every rule is easy to test.
//
//  - RSVP reminder: a guest who has not replied for an event, N days before it, for each N in the
//    wedding's list (14 and 3 by default).
//  - Event reminder: a guest who is attending, the day before the event.
//  - Only guests with an email, who have not unsubscribed.
//  - At most one automatic email per guest per day. If a guest qualifies for both, the event
//    reminder wins, since it is the more useful one that day. The database enforces the same
//    limit with a one-per-guest-per-day key, so a repeated run can never double up.

export type PlanEvent = { id: string; date: Date };
export type PlanGuest = {
  id: string;
  email?: string;
  remindersUnsubscribed: boolean;
  invitations: Array<{ eventId: string; rsvpStatus: RsvpStatus }>;
};
export type PlannedReminder = {
  guestId: string;
  kind: "event_reminder" | "rsvp_reminder";
  eventIds: string[];
};

export function planAutomaticReminders(input: {
  now: Date;
  events: PlanEvent[];
  guests: PlanGuest[];
  rsvpDays: number[];
}): PlannedReminder[] {
  const daysAway = new Map(input.events.map((e) => [e.id, daysUntil(e.date, input.now)]));
  const rsvpDays = new Set(input.rsvpDays);

  return input.guests.flatMap<PlannedReminder>((guest) => {
    if (!guest.email || guest.remindersUnsubscribed) return [];
    const tomorrow: string[] = [];
    const unanswered: string[] = [];
    for (const invitation of guest.invitations) {
      const days = daysAway.get(invitation.eventId);
      if (days === undefined) continue;
      if (days === 1 && invitation.rsvpStatus === "attending") tomorrow.push(invitation.eventId);
      if (invitation.rsvpStatus === "pending" && days >= 1 && rsvpDays.has(days))
        unanswered.push(invitation.eventId);
    }
    if (tomorrow.length > 0)
      return [{ guestId: guest.id, kind: "event_reminder" as const, eventIds: tomorrow }];
    if (unanswered.length > 0)
      return [{ guestId: guest.id, kind: "rsvp_reminder" as const, eventIds: unanswered }];
    return [];
  });
}
