import { describe, expect, it } from "vitest";
import { guestInputSchema, normalizePhone, parseGuestQuery, rsvpSchema } from "./schema";

const E1 = "507f1f77bcf86cd799439011";
const E2 = "507f1f77bcf86cd799439012";
const valid = { name: "Rajesh Sharma", guestsAllowed: "4", invitedEventIds: [E1] };

describe("normalizePhone", () => {
  it("defaults ten digits to +91 and strips formatting", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("098765-43210")).toBe("+919876543210");
    expect(normalizePhone("919876543210")).toBe("+919876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });
  it("keeps other countries as typed", () => {
    expect(normalizePhone("+1 (415) 555-0132")).toBe("+14155550132");
    expect(normalizePhone("0044 20 7946 0958")).toBe("+442079460958");
  });
  it("rejects what is not a phone number", () => {
    for (const bad of ["", "abc", "12345", "+12", "98765432101234567"])
      expect(normalizePhone(bad)).toBeNull();
  });
});

describe("guestInputSchema", () => {
  it("accepts the required fields; the headcount arrives as text from a form", () => {
    expect(guestInputSchema.parse(valid)).toMatchObject({
      name: "Rajesh Sharma",
      guestsAllowed: 4,
      invitedEventIds: [E1],
    });
  });
  it("normalises the phone and lowercases the email", () => {
    expect(
      guestInputSchema.parse({ ...valid, phone: "98765 43210", email: " Raj@Example.COM " }),
    ).toMatchObject({ phone: "+919876543210", email: "raj@example.com" });
  });
  it("treats blank optional fields as not set", () => {
    expect(guestInputSchema.parse({ ...valid, phone: "", email: "", notes: " " })).toMatchObject({
      phone: undefined,
      email: undefined,
      notes: undefined,
    });
  });
  it("needs at least one event, and a form's single checkbox still works", () => {
    expect(guestInputSchema.safeParse({ ...valid, invitedEventIds: [] }).success).toBe(false);
    expect(guestInputSchema.safeParse({ ...valid, invitedEventIds: false }).success).toBe(false);
    expect(guestInputSchema.parse({ ...valid, invitedEventIds: E1 }).invitedEventIds).toEqual([E1]);
  });
  it("rejects a missing name, bad phone, bad email and impossible headcounts", () => {
    for (const bad of [
      { name: " " },
      { phone: "123" },
      { email: "nope" },
      { guestsAllowed: "0" },
      { guestsAllowed: "101" },
      { guestsAllowed: "2.5" },
      { guestsAllowed: "" },
      { invitedEventIds: ["nope"] },
    ])
      expect(guestInputSchema.safeParse({ ...valid, ...bad }).success).toBe(false);
  });
});

describe("rsvpSchema", () => {
  it("attending needs a headcount of at least one", () => {
    expect(rsvpSchema.safeParse({ eventId: E1, status: "attending" }).success).toBe(false);
    expect(
      rsvpSchema.safeParse({ eventId: E1, status: "attending", numberAttending: 0 }).success,
    ).toBe(false);
    expect(
      rsvpSchema.parse({ eventId: E1, status: "attending", numberAttending: "3" }),
    ).toMatchObject({
      numberAttending: 3,
    });
  });
  it("not attending and pending need none", () => {
    expect(rsvpSchema.safeParse({ eventId: E1, status: "not_attending" }).success).toBe(true);
    expect(rsvpSchema.safeParse({ eventId: E1, status: "pending" }).success).toBe(true);
  });
  it("rejects unknown statuses and fractional headcounts", () => {
    expect(rsvpSchema.safeParse({ eventId: E1, status: "maybe" }).success).toBe(false);
    expect(
      rsvpSchema.safeParse({ eventId: E1, status: "attending", numberAttending: 1.5 }).success,
    ).toBe(false);
  });
});

describe("parseGuestQuery", () => {
  it("reads search, event, status and page, and ignores junk", () => {
    expect(parseGuestQuery({ search: " raj ", eventId: E2, status: "pending", page: "3" })).toEqual(
      {
        search: "raj",
        eventId: E2,
        status: "pending",
        page: 3,
      },
    );
    expect(parseGuestQuery({ eventId: "x", status: "bogus", page: "-4" })).toEqual({
      search: undefined,
      eventId: undefined,
      status: undefined,
      page: 1,
    });
  });
});

describe("limits on what a request can carry", () => {
  const base = { name: "Meera", guestsAllowed: 2 };
  it("refuses a guest invited to an absurd number of events", () => {
    const ids = Array.from({ length: 51 }, (_, i) => i.toString(16).padStart(24, "0"));
    expect(guestInputSchema.safeParse({ ...base, invitedEventIds: ids }).success).toBe(false);
    expect(guestInputSchema.safeParse({ ...base, invitedEventIds: ids.slice(0, 50) }).success).toBe(
      true,
    );
  });
});
