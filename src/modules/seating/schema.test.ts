import { describe, expect, it } from "vitest";
import {
  assignSchema,
  moveSchema,
  showTableSchema,
  tableChangeSchema,
  tableInputSchema,
} from "./schema";

const E = "507f1f77bcf86cd799439011";
const T = "507f1f77bcf86cd799439012";
const G = "507f1f77bcf86cd799439013";

describe("tableInputSchema", () => {
  it("takes a name and a whole number of seats, from a form", () => {
    const r = tableInputSchema.safeParse({ eventId: E, name: "  Table 7 ", capacity: "10" });
    expect(r.success && r.data).toMatchObject({ name: "Table 7", capacity: 10 });
  });
  it("refuses a blank name, and seats that are zero, fractional, too many or not a number", () => {
    for (const bad of [
      { name: " " },
      { name: "x".repeat(61) },
      { capacity: "0" },
      { capacity: "2.5" },
      { capacity: "201" },
      { capacity: "" },
      { capacity: "ten" },
      { eventId: "no" },
    ])
      expect(
        tableInputSchema.safeParse({ eventId: E, name: "T", capacity: 10, ...bad }).success,
      ).toBe(false);
  });
});

describe("tableChangeSchema", () => {
  it("needs the table and both fields", () => {
    expect(
      tableChangeSchema.safeParse({ tableId: T, name: "Head table", capacity: 12 }).success,
    ).toBe(true);
    expect(tableChangeSchema.safeParse({ tableId: T, name: "Head table" }).success).toBe(false);
  });
});

describe("assignSchema and moveSchema", () => {
  it("seating needs a table, a party and a positive number of seats", () => {
    expect(assignSchema.safeParse({ tableId: T, guestId: G, seats: "3" }).success).toBe(true);
    for (const seats of [0, -1, "x", 1.5, undefined])
      expect(assignSchema.safeParse({ tableId: T, guestId: G, seats }).success).toBe(false);
  });
  it("a move may leave the seats out, to keep what the party had", () => {
    const r = moveSchema.safeParse({ guestId: G, fromTableId: T, toTableId: E });
    expect(r.success && r.data.seats).toBeUndefined();
    expect(
      moveSchema.safeParse({ guestId: G, fromTableId: T, toTableId: E, seats: 2 }).success,
    ).toBe(true);
    expect(moveSchema.safeParse({ guestId: G, fromTableId: T }).success).toBe(false);
  });
});

describe("showTableSchema", () => {
  it("is an event and on or off", () => {
    expect(showTableSchema.safeParse({ eventId: E, on: true }).success).toBe(true);
    expect(showTableSchema.safeParse({ eventId: E, on: "yes" }).success).toBe(false);
  });
});
