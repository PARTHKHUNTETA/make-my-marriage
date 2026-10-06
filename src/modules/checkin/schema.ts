import { z } from "zod";

// Zod schemas and types for the check-in module (PRD 5.14, api-design §9).

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");
// Numbers arrive from forms as text, and a count of people is a whole number from 1 up.
const people = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z
    .number({ error: "Enter how many arrived" })
    .int("Enter a whole number")
    .min(1, "At least 1")
    .max(1000, "That is too many"),
);
// Chosen by the phone for each scan, so a scan sent twice (a retry, or a queue replayed after the
// signal came back) is recognised as the same one.
const clientKey = z
  .string()
  .min(8, "Missing key")
  .max(64, "Missing key")
  .regex(/^[A-Za-z0-9_-]+$/, "Bad key");
const entryToken = z
  .string()
  .trim()
  .min(10, "That isn't a valid entry code")
  .max(64, "That isn't a valid entry code");

export const lookupSchema = z.object({ eventId: objectId, entryToken });
export const searchSchema = z.object({
  eventId: objectId,
  query: z.string().trim().min(2, "Type at least 2 letters").max(100),
});
export const checkInSchema = z.object({
  eventId: objectId,
  guestId: objectId,
  arrivedCount: people,
  clientKey,
});
export const walkInSchema = z.object({
  eventId: objectId,
  name: z.string().trim().min(1, "Enter a name").max(150, "That name is too long"),
  arrivedCount: people,
  // Set when the person is a known party that is simply not on this event's list.
  guestId: objectId.optional(),
  clientKey,
});
// Scans made with no signal: just the code and when. The server works out the party and, if no
// count was typed, takes the number they said would come.
export const syncSchema = z.object({
  eventId: objectId,
  scans: z
    .array(
      z.object({
        entryToken,
        clientKey,
        arrivedCount: people.optional(),
        scannedAt: z.coerce.date().optional(),
      }),
    )
    .min(1)
    .max(100),
});
export const eventOnlySchema = z.object({ eventId: objectId });

export type CheckInRecord = {
  id: string;
  guestId?: string;
  walkInName?: string;
  arrivedCount: number;
  checkedInAt: Date;
  walkIn: boolean;
};

export type EntryLookup =
  | {
      kind: "party";
      guestId: string;
      name: string;
      status: "pending" | "attending" | "not_attending";
      numberAttending?: number;
      guestsAllowed: number;
      notes?: string;
      table?: string;
      checkedIn?: { at: Date; count: number };
    }
  | { kind: "not_on_list"; guestId: string; name: string }
  | { kind: "unknown" };

export type PartyMatch = {
  guestId: string;
  name: string;
  phone?: string;
  invited: boolean;
  status?: "pending" | "attending" | "not_attending";
  numberAttending?: number;
  guestsAllowed: number;
  checkedIn?: { at: Date; count: number };
};

export type Counter = { arrived: number; arrivedParties: number; expected: number };

export type CheckInOutcome = { status: "checked_in" | "already"; record: CheckInRecord };
