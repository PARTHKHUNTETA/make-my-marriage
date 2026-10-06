import { describe, expect, it } from "vitest";
import { planAutomaticReminders, type PlanGuest } from "./reminders";

const day = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);
const now = new Date("2027-02-01T10:00:00+05:30");
const events = [
  { id: "far", date: day("2027-02-15") }, // 14 days away
  { id: "near", date: day("2027-02-04") }, // 3 days away
  { id: "tomorrow", date: day("2027-02-02") },
  { id: "past", date: day("2027-01-30") },
];
const guest = (over: Partial<PlanGuest> = {}): PlanGuest => ({
  id: "g1",
  email: "g@example.com",
  remindersUnsubscribed: false,
  invitations: [],
  ...over,
});
const plan = (guests: PlanGuest[], rsvpDays = [14, 3]) =>
  planAutomaticReminders({ now, events, guests, rsvpDays });

describe("planAutomaticReminders", () => {
  it("asks guests who have not replied, exactly on the chosen days before the event", () => {
    const g = guest({
      invitations: [
        { eventId: "far", rsvpStatus: "pending" },
        { eventId: "near", rsvpStatus: "pending" },
      ],
    });
    expect(plan([g])).toEqual([
      { guestId: "g1", kind: "rsvp_reminder", eventIds: ["far", "near"] },
    ]);
    expect(plan([g], [14])).toEqual([{ guestId: "g1", kind: "rsvp_reminder", eventIds: ["far"] }]);
    expect(plan([g], [10, 5])).toEqual([]);
  });

  it("does not ask guests who have already replied", () => {
    const g = guest({
      invitations: [
        { eventId: "far", rsvpStatus: "attending" },
        { eventId: "near", rsvpStatus: "not_attending" },
      ],
    });
    expect(plan([g])).toEqual([]);
  });

  it("reminds attending guests the day before, and no one else", () => {
    const attending = guest({
      id: "a",
      invitations: [{ eventId: "tomorrow", rsvpStatus: "attending" }],
    });
    const declined = guest({
      id: "d",
      invitations: [{ eventId: "tomorrow", rsvpStatus: "not_attending" }],
    });
    const pending = guest({
      id: "p",
      invitations: [{ eventId: "tomorrow", rsvpStatus: "pending" }],
    });
    expect(plan([attending, declined, pending])).toEqual([
      { guestId: "a", kind: "event_reminder", eventIds: ["tomorrow"] },
    ]);
  });

  it("a pending guest is still asked the day before if 1 is one of the chosen days", () => {
    const pending = guest({ invitations: [{ eventId: "tomorrow", rsvpStatus: "pending" }] });
    expect(plan([pending], [1])).toEqual([
      { guestId: "g1", kind: "rsvp_reminder", eventIds: ["tomorrow"] },
    ]);
  });

  it("never sends a guest more than one email in a day; the event reminder wins", () => {
    const g = guest({
      invitations: [
        { eventId: "near", rsvpStatus: "pending" },
        { eventId: "tomorrow", rsvpStatus: "attending" },
      ],
    });
    expect(plan([g])).toEqual([{ guestId: "g1", kind: "event_reminder", eventIds: ["tomorrow"] }]);
  });

  it("two events tomorrow become one email", () => {
    const g = guest({
      invitations: [
        { eventId: "tomorrow", rsvpStatus: "attending" },
        { eventId: "tomorrow", rsvpStatus: "attending" },
      ],
    });
    expect(plan([g])).toHaveLength(1);
  });

  it("skips guests without an email or who unsubscribed", () => {
    const inv = [{ eventId: "far", rsvpStatus: "pending" as const }];
    expect(plan([guest({ email: undefined, invitations: inv })])).toEqual([]);
    expect(plan([guest({ remindersUnsubscribed: true, invitations: inv })])).toEqual([]);
  });

  it("ignores events that are today, past, or no longer exist", () => {
    const g = guest({
      invitations: [
        { eventId: "past", rsvpStatus: "pending" },
        { eventId: "deleted", rsvpStatus: "pending" },
      ],
    });
    expect(plan([g], [1, 2, 3, 14, -2, 0])).toEqual([]);
  });

  it("counts days in India, not UTC", () => {
    // 00:30 IST on 1 Feb is still 31 Jan in UTC; the event is still 3 days away in India.
    const early = new Date("2027-02-01T00:30:00+05:30");
    const g = guest({ invitations: [{ eventId: "near", rsvpStatus: "pending" }] });
    expect(planAutomaticReminders({ now: early, events, guests: [g], rsvpDays: [3] })).toHaveLength(
      1,
    );
  });
});
