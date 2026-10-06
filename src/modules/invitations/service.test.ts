import { describe, expect, it, vi, beforeEach } from "vitest";

const guests = vi.hoisted(() => ({ getGuestByToken: vi.fn(), submitRsvp: vi.fn() }));
const events = vi.hoisted(() => ({ getEventsByIds: vi.fn() }));
const wedding = vi.hoisted(() => ({ getWedding: vi.fn() }));
vi.mock("@/modules/guests/service", () => guests);
vi.mock("@/modules/events/service", () => events);
vi.mock("@/modules/wedding/service", () => wedding);
const tableNamesForParty = vi.hoisted(() => vi.fn());
vi.mock("@/modules/seating/service", () => ({ tableNamesForParty }));

import { getInvitation, submitGuestRsvp } from "./service";

const E1 = "507f1f77bcf86cd799439011";
const E2 = "507f1f77bcf86cd799439012";
const guest = (over = {}) => ({
  guest: {
    id: "g1",
    name: "Rajesh Sharma",
    guestsAllowed: 4,
    token: "tok",
    remindersUnsubscribed: false,
    invitations: [
      { eventId: E1, rsvpStatus: "attending", numberAttending: 3 },
      { eventId: E2, rsvpStatus: "pending" },
    ],
    ...over,
  },
  weddingId: "w1",
});
// 7 PM on 12 Feb 2027 in India.
const event = (id: string, name: string, date: string, startTime = "19:00") => ({
  id,
  name,
  date: new Date(`${date}T00:00:00+05:30`),
  startTime,
  type: "custom",
  showOnWebsite: true,
});
const before = new Date("2027-02-10T10:00:00+05:30");
const after = new Date("2027-02-12T19:00:00+05:30");

beforeEach(() => {
  tableNamesForParty.mockReset().mockResolvedValue(new Map());
  guests.getGuestByToken.mockReset().mockResolvedValue(guest());
  guests.submitRsvp.mockReset().mockResolvedValue({});
  events.getEventsByIds
    .mockReset()
    .mockResolvedValue([event(E1, "Sangeet", "2027-02-11"), event(E2, "Wedding", "2027-02-12")]);
  wedding.getWedding
    .mockReset()
    .mockResolvedValue({ brideName: "Priya", groomName: "Aarav", title: "Priya weds Aarav" });
});

describe("getInvitation", () => {
  it("greets the family and shows only the invited events with their replies", async () => {
    const view = await getInvitation("tok", before);
    expect(view).toMatchObject({
      couple: "Priya & Aarav",
      greeting: "Dear Rajesh Sharma & family",
      guestsAllowed: 4,
    });
    expect(view?.events.map((e) => [e.name, e.status, e.numberAttending, e.locked])).toEqual([
      ["Sangeet", "attending", 3, false],
      ["Wedding", "pending", undefined, false],
    ]);
    expect(events.getEventsByIds).toHaveBeenCalledWith("w1", [E1, E2]);
  });

  it("uses a plain greeting for a single guest", async () => {
    guests.getGuestByToken.mockResolvedValue(guest({ guestsAllowed: 1 }));
    expect((await getInvitation("tok", before))?.greeting).toBe("Dear Rajesh Sharma");
  });

  it("locks an event once it has started, and not before", async () => {
    expect((await getInvitation("tok", after))?.events.map((e) => e.locked)).toEqual([true, true]);
    const justBefore = new Date("2027-02-12T18:59:00+05:30");
    expect((await getInvitation("tok", justBefore))?.events.map((e) => e.locked)).toEqual([
      true,
      false,
    ]);
  });

  it("is null for an unknown link or a deleted wedding", async () => {
    guests.getGuestByToken.mockResolvedValue(null);
    expect(await getInvitation("tok", before)).toBeNull();
    guests.getGuestByToken.mockResolvedValue(guest());
    wedding.getWedding.mockResolvedValue(null);
    expect(await getInvitation("tok", before)).toBeNull();
  });
});

describe("your table", () => {
  it("shows the table only when the event switches it on and the party is attending and seated", async () => {
    events.getEventsByIds.mockResolvedValue([
      { ...event(E1, "Sangeet", "2027-02-11"), showTable: true },
      { ...event(E2, "Wedding", "2027-02-12"), showTable: true },
    ]);
    tableNamesForParty.mockResolvedValue(
      new Map([
        [E1, ["7"]],
        [E2, ["3"]],
      ]),
    );
    const view = await getInvitation("tok", before);
    // Sangeet: attending and seated. Wedding: no reply yet, so no table is shown.
    expect(view?.events.map((e) => e.tableLabel)).toEqual(["Your table: 7", undefined]);
  });
  it("never shows a table for an event that has it switched off, and does not even look it up", async () => {
    tableNamesForParty.mockResolvedValue(new Map([[E1, ["7"]]]));
    const view = await getInvitation("tok", before);
    expect(view?.events.every((e) => e.tableLabel === undefined)).toBe(true);
    expect(tableNamesForParty).not.toHaveBeenCalled();
  });
  it("says tables when a party is split", async () => {
    events.getEventsByIds.mockResolvedValue([
      { ...event(E1, "Sangeet", "2027-02-11"), showTable: true },
    ]);
    tableNamesForParty.mockResolvedValue(new Map([[E1, ["7", "9"]]]));
    expect((await getInvitation("tok", before))?.events[0]?.tableLabel).toBe(
      "Your tables: 7 and 9",
    );
  });
});

describe("submitGuestRsvp", () => {
  const reply = { eventId: E2, status: "attending" as const, numberAttending: 2 };

  it("saves a reply before the event starts", async () => {
    await submitGuestRsvp("tok", reply, before);
    expect(guests.submitRsvp).toHaveBeenCalledWith("tok", E2, {
      status: "attending",
      numberAttending: 2,
    });
  });

  it("refuses after the event has started (RSVP_LOCKED)", async () => {
    await expect(submitGuestRsvp("tok", reply, after)).rejects.toMatchObject({
      code: "RSVP_LOCKED",
    });
    expect(guests.submitRsvp).not.toHaveBeenCalled();
  });

  it("refuses an event the guest is not invited to (NOT_INVITED)", async () => {
    events.getEventsByIds.mockResolvedValue([event(E1, "Sangeet", "2027-02-11")]);
    await expect(submitGuestRsvp("tok", reply, before)).rejects.toMatchObject({
      code: "NOT_INVITED",
    });
  });

  it("refuses an unknown link with the friendly code", async () => {
    guests.getGuestByToken.mockResolvedValue(null);
    await expect(submitGuestRsvp("tok", reply, before)).rejects.toMatchObject({
      code: "LINK_INVALID",
    });
  });

  it("does not let a guest reset their reply to 'no reply yet'", async () => {
    await expect(
      submitGuestRsvp("tok", { eventId: E2, status: "pending" }, before),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
