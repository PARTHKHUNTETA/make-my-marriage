import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): guests, invitations and RSVPs on the real database with
// two throwaway weddings, removed afterwards. No emails are sent.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn().mockResolvedValue(undefined) }));

describe.skipIf(!enabled)("guests and RSVPs against MongoDB", () => {
  let guests: typeof import("./service");
  let schema: typeof import("./schema");
  let events: typeof import("@/modules/events/service");
  let eventSchema: typeof import("@/modules/events/schema");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();
  let sangeet: string;
  let wedding: string;

  const guest = (over: Record<string, unknown> = {}) =>
    schema.guestInputSchema.parse({
      name: "Rajesh Sharma",
      guestsAllowed: 4,
      invitedEventIds: [sangeet, wedding],
      ...over,
    });
  const ev = (over: Record<string, unknown> = {}) =>
    eventSchema.eventInputSchema.parse({
      type: "custom",
      name: "Event",
      date: "2027-02-12",
      startTime: "19:00",
      ...over,
    });
  const clean = () =>
    Promise.all(
      ["guests", "events", "tasks"].map((n) =>
        db.collection(n).deleteMany({ weddingId: { $in: [wA, wB] } }),
      ),
    );

  beforeAll(async () => {
    guests = await import("./service");
    schema = await import("./schema");
    events = await import("@/modules/events/service");
    eventSchema = await import("@/modules/events/schema");
    db = await (await import("@/lib/db")).getDb();
    await guests.listGuests(A, { page: 1 }); // creates the indexes
    await events.listEvents(A);
    await clean();
    sangeet = (await events.createEvent(A, ev({ name: "Sangeet" }))).id;
    wedding = (await events.createEvent(A, ev({ name: "Wedding" }))).id;
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("creates a party with a pending invitation, entry token and link token per event", async () => {
    const g = await guests.createGuest(A, guest());
    expect(g.token).toMatch(/^[0-9A-Za-z]{22}$/);
    expect(g.invitations.map((i) => [i.eventId, i.rsvpStatus])).toEqual([
      [sangeet, "pending"],
      [wedding, "pending"],
    ]);
    const raw = await db.collection("guests").findOne({ token: g.token });
    const tokens = raw!.invitations.map((i: { entryToken: string }) => i.entryToken);
    expect(new Set([...tokens, g.token]).size).toBe(3);
  });

  it("one wedding never sees or changes another wedding's guests", async () => {
    const g = await guests.createGuest(A, guest({ name: "Only in A" }));
    expect((await guests.listGuests(B, { page: 1 })).total).toBe(0);
    expect(await guests.getGuest(B, g.id)).toBeNull();
    await expect(guests.updateGuest(B, g.id, guest())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(guests.deleteGuest(B, g.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      guests.overrideRsvp(B, g.id, sangeet, { status: "not_attending" }),
    ).rejects.toMatchObject({ code: "LINK_INVALID" });
    expect((await guests.getGuest(A, g.id))?.name).toBe("Only in A");
  });

  it("a guest's RSVP replaces the earlier one, and a headcount over the allowance is refused", async () => {
    const g = await guests.createGuest(A, guest({ name: "Rsvp Tester", guestsAllowed: 3 }));
    await guests.submitRsvp(g.token, sangeet, { status: "attending", numberAttending: 3 });
    let saved = await guests.getGuest(A, g.id);
    expect(saved?.invitations.find((i) => i.eventId === sangeet)).toMatchObject({
      rsvpStatus: "attending",
      numberAttending: 3,
    });
    expect(saved?.invitations.find((i) => i.eventId === wedding)?.rsvpStatus).toBe("pending");

    await expect(
      guests.submitRsvp(g.token, sangeet, { status: "attending", numberAttending: 4 }),
    ).rejects.toMatchObject({ code: "RSVP_OVER_LIMIT" });
    expect(
      (await guests.getGuest(A, g.id))?.invitations.find((i) => i.eventId === sangeet)
        ?.numberAttending,
    ).toBe(3);

    await guests.submitRsvp(g.token, sangeet, { status: "not_attending", numberAttending: 9 });
    saved = await guests.getGuest(A, g.id);
    const reply = saved?.invitations.find((i) => i.eventId === sangeet);
    expect(reply?.rsvpStatus).toBe("not_attending");
    expect(reply?.numberAttending).toBeUndefined();
    expect(saved?.invitations).toHaveLength(2); // never a duplicate
  });

  it("refuses an unknown link and an event the guest is not invited to", async () => {
    await expect(
      guests.submitRsvp("nonexistent-token-123456", sangeet, { status: "not_attending" }),
    ).rejects.toMatchObject({ code: "LINK_INVALID" });
    const only = await guests.createGuest(
      A,
      guest({ name: "One event", invitedEventIds: [wedding] }),
    );
    await expect(
      guests.submitRsvp(only.token, sangeet, { status: "not_attending" }),
    ).rejects.toMatchObject({ code: "NOT_INVITED" });
  });

  it("two simultaneous replies leave exactly one invitation entry per event", async () => {
    const g = await guests.createGuest(A, guest({ name: "Racer", guestsAllowed: 5 }));
    await Promise.all([
      guests.submitRsvp(g.token, sangeet, { status: "attending", numberAttending: 2 }),
      guests.submitRsvp(g.token, wedding, { status: "attending", numberAttending: 5 }),
      guests.submitRsvp(g.token, sangeet, { status: "attending", numberAttending: 4 }),
    ]);
    const saved = await guests.getGuest(A, g.id);
    expect(saved?.invitations).toHaveLength(2);
    expect(saved?.invitations.find((i) => i.eventId === wedding)?.numberAttending).toBe(5);
    expect([2, 4]).toContain(
      saved?.invitations.find((i) => i.eventId === sangeet)?.numberAttending,
    );
  });

  it("editing a guest keeps replies for events that stay, drops removed ones, adds new ones pending", async () => {
    const third = (await events.createEvent(A, ev({ name: "Reception" }))).id;
    const g = await guests.createGuest(A, guest({ name: "Editor" }));
    await guests.submitRsvp(g.token, sangeet, { status: "attending", numberAttending: 2 });
    await guests.submitRsvp(g.token, wedding, { status: "not_attending" });
    const before = await db.collection("guests").findOne({ token: g.token });
    const sangeetEntry = before!.invitations.find(
      (i: { eventId: ObjectId }) => i.eventId.toHexString() === sangeet,
    ).entryToken;

    const updated = await guests.updateGuest(
      A,
      g.id,
      guest({ name: "Editor Renamed", invitedEventIds: [sangeet, third], phone: "98765 43210" }),
    );
    expect(updated.name).toBe("Editor Renamed");
    expect(updated.phone).toBe("+919876543210");
    expect(updated.invitations.map((i) => [i.eventId, i.rsvpStatus, i.numberAttending])).toEqual([
      [sangeet, "attending", 2],
      [third, "pending", undefined],
    ]);
    const after = await db.collection("guests").findOne({ token: g.token });
    expect(after!.invitations[0].entryToken).toBe(sangeetEntry); // same QR for an event that stays
    expect(after!.invitations[1].entryToken).toMatch(/^[0-9A-Za-z]{22}$/);
    expect(after!.token).toBe(g.token); // the link does not change
  });

  it("clearing phone, email and notes removes them from the document", async () => {
    const g = await guests.createGuest(
      A,
      guest({ name: "Cleared", phone: "9876500001", email: "x@example.com", notes: "n" }),
    );
    await guests.updateGuest(A, g.id, guest({ name: "Cleared" }));
    const raw = await db.collection("guests").findOne({ token: g.token });
    for (const f of ["phone", "email", "notes"]) expect(raw).not.toHaveProperty(f);
  });

  it("finds a duplicate phone, but not the guest's own number", async () => {
    const g = await guests.createGuest(A, guest({ name: "Phone Owner", phone: "9123456780" }));
    expect(await guests.findPhoneDuplicate(A, "+919123456780")).toBe("Phone Owner");
    expect(await guests.findPhoneDuplicate(A, "+919123456780", g.id)).toBeNull();
    expect(await guests.findPhoneDuplicate(B, "+919123456780")).toBeNull();
  });

  it("members can override a reply any time, including a reset to pending", async () => {
    const g = await guests.createGuest(A, guest({ name: "Overridden", guestsAllowed: 2 }));
    await guests.overrideRsvp(A, g.id, wedding, { status: "attending", numberAttending: 2 });
    await expect(
      guests.overrideRsvp(A, g.id, wedding, { status: "attending", numberAttending: 3 }),
    ).rejects.toMatchObject({ code: "RSVP_OVER_LIMIT" });
    await guests.overrideRsvp(A, g.id, wedding, { status: "pending" });
    const reply = (await guests.getGuest(A, g.id))?.invitations.find((i) => i.eventId === wedding);
    expect(reply).toMatchObject({ rsvpStatus: "pending" });
    expect(reply?.numberAttending).toBeUndefined();
    expect(reply?.respondedAt).toBeUndefined();
  });

  it("lists with search, event and reply filters, in name order, with paging", async () => {
    await db.collection("guests").deleteMany({ weddingId: wA });
    const names = ["bravo Kumar", "Alpha Singh", "Charlie Rao"];
    const made = [];
    for (const [i, name] of names.entries())
      made.push(
        await guests.createGuest(
          A,
          guest({
            name,
            phone: `98000000${i}0`,
            invitedEventIds: i === 2 ? [wedding] : [sangeet, wedding],
          }),
        ),
      );
    await guests.submitRsvp(made[0]!.token, sangeet, { status: "attending", numberAttending: 1 });

    const names_ = async (q: Partial<import("./schema").GuestQuery>) =>
      (await guests.listGuests(A, { page: 1, ...q })).items.map((g) => g.name);
    expect(await names_({})).toEqual(["Alpha Singh", "bravo Kumar", "Charlie Rao"]);
    expect(await names_({ search: "BRAVO" })).toEqual(["bravo Kumar"]);
    expect(await names_({ search: "98000000 1" })).toEqual(["Alpha Singh"]);
    expect(await names_({ search: "a.*" })).toEqual([]); // regex characters are literal
    expect(await names_({ eventId: sangeet })).toEqual(["Alpha Singh", "bravo Kumar"]);
    expect(await names_({ eventId: sangeet, status: "attending" })).toEqual(["bravo Kumar"]);
    expect(await names_({ eventId: sangeet, status: "pending" })).toEqual(["Alpha Singh"]);
    expect(await names_({ status: "attending" })).toEqual(["bravo Kumar"]);
    expect((await guests.listGuests(A, { page: 2 })).items).toEqual([]);
  });

  it("totals: parties, replies, waiting and people expected, overall and per event", async () => {
    await db.collection("guests").deleteMany({ weddingId: wA });
    const a = await guests.createGuest(A, guest({ name: "A", guestsAllowed: 4 }));
    const b = await guests.createGuest(A, guest({ name: "B", guestsAllowed: 2 }));
    await guests.createGuest(A, guest({ name: "C", invitedEventIds: [wedding] }));
    await guests.submitRsvp(a.token, sangeet, { status: "attending", numberAttending: 3 });
    await guests.submitRsvp(a.token, wedding, { status: "attending", numberAttending: 4 });
    await guests.submitRsvp(b.token, sangeet, { status: "not_attending" });

    const stats = await guests.getStats(A);
    expect(stats).toMatchObject({ parties: 3, responded: 2, pending: 1, headcount: 4 });
    const per = Object.fromEntries(stats.perEvent.map((e) => [e.eventId, e]));
    expect(per[sangeet]).toMatchObject({
      invited: 2,
      attending: 1,
      notAttending: 1,
      pending: 0,
      headcount: 3,
    });
    expect(per[wedding]).toMatchObject({
      invited: 3,
      attending: 1,
      notAttending: 0,
      pending: 2,
      headcount: 4,
    });
    expect((await guests.getStats(B)).parties).toBe(0);
  });

  it("deleting an event removes every guest's invitation and reply for it, and keeps the rest", async () => {
    await db.collection("guests").deleteMany({ weddingId: wA });
    const doomed = (await events.createEvent(A, ev({ name: "Doomed" }))).id;
    const g = await guests.createGuest(A, guest({ invitedEventIds: [sangeet, doomed] }));
    await guests.submitRsvp(g.token, doomed, { status: "attending", numberAttending: 2 });
    expect(await events.previewEventDelete(A, doomed)).toMatchObject({ guestCount: 1 });

    await events.deleteEvent(A, doomed);

    const saved = await guests.getGuest(A, g.id);
    expect(saved?.invitations.map((i) => i.eventId)).toEqual([sangeet]);
  });

  it("deleting a guest makes their link stop working", async () => {
    const g = await guests.createGuest(A, guest({ name: "Gone" }));
    await guests.deleteGuest(A, g.id);
    expect(await guests.getGuestByToken(g.token)).toBeNull();
  });

  it("resolves a link to exactly one guest and wedding", async () => {
    const g = await guests.createGuest(A, guest({ name: "Linked" }));
    const found = await guests.getGuestByToken(g.token);
    expect(found).toMatchObject({ weddingId: A, guest: { id: g.id, name: "Linked" } });
    expect(await guests.getGuestByToken("short")).toBeNull();
    expect(await guests.getGuestByToken("x".repeat(22))).toBeNull();
  });
});
