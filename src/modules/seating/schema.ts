import { z } from "zod";

// Zod schemas and types for the seating module (PRD 5.13, api-design §9).

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");
const wholeNumber = (what: string, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
    z
      .number({ error: `Enter ${what}` })
      .int("Enter a whole number")
      .min(1, "At least 1")
      .max(max, `At most ${max}`),
  );

export const MAX_CAPACITY = 200;

export const tableInputSchema = z.object({
  eventId: objectId,
  name: z.string().trim().min(1, "Give the table a name or number").max(60, "That is too long"),
  capacity: wholeNumber("how many seats", MAX_CAPACITY),
});
export const tableChangeSchema = z.object({
  tableId: objectId,
  name: z.string().trim().min(1, "Give the table a name or number").max(60, "That is too long"),
  capacity: wholeNumber("how many seats", MAX_CAPACITY),
});
export const tableIdSchema = z.object({ tableId: objectId });
export const assignSchema = z.object({
  tableId: objectId,
  guestId: objectId,
  seats: wholeNumber("how many seats", MAX_CAPACITY),
});
export const unassignSchema = z.object({ tableId: objectId, guestId: objectId });
export const moveSchema = z.object({
  guestId: objectId,
  fromTableId: objectId,
  toTableId: objectId,
  // Left out, the party keeps the seats it had at the first table.
  seats: wholeNumber("how many seats", MAX_CAPACITY).optional(),
});
export const showTableSchema = z.object({ eventId: objectId, on: z.boolean() });

export type Assignment = { guestId: string; seats: number };

export type TableItem = {
  id: string;
  eventId: string;
  name: string;
  capacity: number;
  assignments: Assignment[];
};

// ---- the plan shown on the seating page ----

export type SeatingParty = {
  id: string;
  name: string;
  status: "pending" | "attending" | "not_attending";
  guestsAllowed: number;
  numberAttending?: number;
};

export type SeatedParty = {
  party: SeatingParty;
  seats: number;
  // The party is no longer coming, so these seats should be given up.
  notAttending: boolean;
  // The party has more seats across tables than it needs.
  tooMany: boolean;
};

export type PlannedTable = {
  table: TableItem;
  seated: SeatedParty[];
  used: number;
  free: number; // negative when over capacity
  over: boolean;
};

export type Unseated = { party: SeatingParty; need: number; seated: number; remaining: number };

export type SeatingPlan = {
  tables: PlannedTable[];
  // Attending parties who still need seats, including part-seated ones.
  unseated: Unseated[];
  // Parties who have not replied yet: they can be seated, using the number allowed.
  awaitingReply: Unseated[];
  totalSeats: number;
  seatedPeople: number;
  needingSeats: number;
};
