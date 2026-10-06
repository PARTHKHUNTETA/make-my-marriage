import type { RsvpStatus } from "@/modules/guests/schema";

// What a guest sees at their personal link (PRD 6): their name and only the events they are
// invited to. Nothing about other guests or the wedding's internals.
export type InvitationEventView = {
  eventId: string;
  name: string;
  date: Date;
  startTime: string;
  endTime?: string;
  venueName?: string;
  address?: string;
  dressCode?: string;
  description?: string;
  status: RsvpStatus;
  numberAttending?: number;
  // True once the event has started: the reply is then shown read-only (PRD 5.6).
  locked: boolean;
  // "Your table: 7", only when the couple has switched this on for the event and seated the party.
  tableLabel?: string;
};

export type InvitationView = {
  couple: string; // "Priya & Aarav"
  weddingTitle: string;
  greeting: string; // "Dear Rajesh Sharma & family"
  guestName: string;
  guestsAllowed: number;
  events: InvitationEventView[];
};
