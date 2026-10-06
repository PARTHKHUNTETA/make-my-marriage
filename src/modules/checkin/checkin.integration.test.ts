import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): check-in at the gate on the real database, with two
// throwaway weddings removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("check-in against MongoDB", () => {
  let checkin: typeof import("./service");
  let guests: typeof import("@/modules/guests/service");
  let guestSchema: typeof import("@/modules/guests/schema");
  let events: typeof import("@/modules/events/service");
  let eventSchema: typeof import("@/modules/events/schema");
  let seating: typeof import("@/modules/seating/service");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();
  const M = new ObjectId().toHexString(); // a member id
  let ev: string;
  let other: string;
  let n = 0;
  const key = () => `key-${Date.now()}-${n++}`;

  const mkEvent = (name: string) =>
    events.createEvent(
      A,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name,
        date: "2099-02-13",
        startTime: "19:00",
      }),
    );
  const mkGuest = (name: string, eventIds: string[], over: Record<string, unknown> = {}) =>
    guests.createGuest(
      A,
      guestSchema.guestInputSchema.parse({
        name,
        guestsAllowed: 4,
        invitedEventIds: eventIds,
        ...over,
      }),
    );
  const entryOf = async (guestId: string, eventId: string) =>
    (await db.collection("guests").findOne({ _id: new ObjectId(guestId) }))!.invitations.find(
      (i: { eventId: ObjectId }) => i.eventId.toHexString() === eventId,
    ).entryToken as string;
  const clean = () =>
    Promise.all(
      ["checkIns", "guests", "events", "seatingTables"].map((c) =>
        db.collection(c).deleteMany({ weddingId: { $in: [wA, wB] } }),
      ),
    );

  beforeAll(async () => {
    checkin = await import("./service");
    guests = await import("@/modules/guests/service");
    guestSchema = await import("@/modules/guests/schema");
    events = await import("@/modules/events/service");
    eventSchema = await import("@/modules/events/schema");
    seating = await import("@/modules/seating/service");
    db = await (await import("@/lib/db")).getDb();
    await events.listEvents(A);
    await guests.listGuests(A, { page: 1 });
    await seating.listEventTables(A, new ObjectId().toHexString());
    await checkin.getCounter(A, (await mkEvent("warm up")).id).catch(() => undefined);
    await clean();
    ev = (await mkEvent("Sangeet")).id;
    other = (await mkEvent("Wedding")).id;
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("a scanned code leads to the party, its numbers, notes and table", async () => {
    const g = await mkGuest("Scan Sharma", [ev], { notes: "Arriving from Jaipur" });
    await guests.submitRsvp(g.token, ev, { status: "attending", numberAttending: 3 });
    const t = await seating.addTable(A, { eventId: ev, name: "Table 7", capacity: 10 });
    await seating.assignParty(A, t.id, g.id, 3);
    const found = await checkin.lookupEntry(A, ev, await entryOf(g.id, ev));
    expect(found).toMatchObject({
      kind: "party",
      name: "Scan Sharma",
      status: "attending",
      numberAttending: 3,
      guestsAllowed: 4,
      notes: "Arriving from Jaipur",
      table: "Table 7",
    });
    expect((found as { checkedIn?: unknown }).checkedIn).toBeUndefined();
  });

  it("an unknown code, another wedding's code, and a code for a different event are all told apart", async () => {
    const g = await mkGuest("Other Event", [other]);
    expect(await checkin.lookupEntry(A, ev, "x".repeat(22))).toEqual({ kind: "unknown" });
    const code = await entryOf(g.id, other);
    expect(await checkin.lookupEntry(A, ev, code)).toMatchObject({
      kind: "not_on_list",
      name: "Other Event",
    });
    expect(await checkin.lookupEntry(A, other, code)).toMatchObject({ kind: "party" });
    // The same code means nothing in another wedding.
    const b = await events.createEvent(
      B,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name: "B event",
        date: "2099-02-13",
        startTime: "19:00",
      }),
    );
    expect(await checkin.lookupEntry(B, b.id, code)).toEqual({ kind: "unknown" });
  });

  it("checking in records the arrival; scanning again says when and how many, and changes nothing", async () => {
    const g = await mkGuest("Twice Tara", [ev]);
    const first = await checkin.checkInParty(A, M, {
      eventId: ev,
      guestId: g.id,
      arrivedCount: 3,
      clientKey: key(),
    });
    expect(first.status).toBe("checked_in");
    const again = await checkin.checkInParty(A, M, {
      eventId: ev,
      guestId: g.id,
      arrivedCount: 5,
      clientKey: key(),
    });
    expect(again.status).toBe("already");
    expect(again.record).toMatchObject({ id: first.record.id, arrivedCount: 3 });
    expect(
      await db
        .collection("checkIns")
        .countDocuments({ weddingId: wA, eventId: new ObjectId(ev), guestId: new ObjectId(g.id) }),
    ).toBe(1);
    const found = await checkin.lookupEntry(A, ev, await entryOf(g.id, ev));
    expect((found as { checkedIn?: { count: number } }).checkedIn?.count).toBe(3);
  });

  it("many scans of one party at the same moment still count it once", async () => {
    const g = await mkGuest("Racer Rita", [ev]);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        checkin.checkInParty(A, M, {
          eventId: ev,
          guestId: g.id,
          arrivedCount: 2,
          clientKey: key(),
        }),
      ),
    );
    expect(results.filter((r) => r.status === "checked_in")).toHaveLength(1);
    expect(
      await db
        .collection("checkIns")
        .countDocuments({ guestId: new ObjectId(g.id), eventId: new ObjectId(ev) }),
    ).toBe(1);
  });

  it("the same party can be checked in to a different event separately", async () => {
    const g = await mkGuest("Both Events", [ev, other]);
    expect(
      (
        await checkin.checkInParty(A, M, {
          eventId: ev,
          guestId: g.id,
          arrivedCount: 2,
          clientKey: key(),
        })
      ).status,
    ).toBe("checked_in");
    expect(
      (
        await checkin.checkInParty(A, M, {
          eventId: other,
          guestId: g.id,
          arrivedCount: 2,
          clientKey: key(),
        })
      ).status,
    ).toBe("checked_in");
  });

  it("one wedding cannot check in, count, or see another wedding's parties", async () => {
    const g = await mkGuest("Scoped Sana", [ev]);
    const b = await events.createEvent(
      B,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name: "B",
        date: "2099-02-13",
        startTime: "19:00",
      }),
    );
    await expect(
      checkin.checkInParty(B, M, {
        eventId: b.id,
        guestId: g.id,
        arrivedCount: 1,
        clientKey: key(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      checkin.checkInParty(B, M, { eventId: ev, guestId: g.id, arrivedCount: 1, clientKey: key() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await checkin.searchParties(B, b.id, "Scoped")).toEqual([]);
    expect((await checkin.getCounter(B, b.id)).arrived).toBe(0);
  });

  it("a walk-in is admitted without a record, and replaying the same admission counts once", async () => {
    const k = key();
    const first = await checkin.admitWalkIn(A, M, {
      eventId: ev,
      name: "Uncle Raj",
      arrivedCount: 2,
      clientKey: k,
    });
    const replay = await checkin.admitWalkIn(A, M, {
      eventId: ev,
      name: "Uncle Raj",
      arrivedCount: 2,
      clientKey: k,
    });
    expect(first).toMatchObject({
      status: "checked_in",
      record: { walkIn: true, walkInName: "Uncle Raj", arrivedCount: 2 },
    });
    expect(replay).toMatchObject({ status: "already", record: { id: first.record.id } });
  });

  it("a known party not invited to this event can be admitted, and is then on record", async () => {
    const g = await mkGuest("Not Invited Nina", [other]);
    const results = await checkin.searchParties(A, ev, "Not Invited");
    expect(results[0]).toMatchObject({ name: "Not Invited Nina", invited: false });
    const admitted = await checkin.admitWalkIn(A, M, {
      eventId: ev,
      name: "ignored",
      guestId: g.id,
      arrivedCount: 2,
      clientKey: key(),
    });
    expect(admitted.record).toMatchObject({ guestId: g.id, walkIn: true });
    expect((await checkin.searchParties(A, ev, "Not Invited"))[0]?.checkedIn?.count).toBe(2);
    await expect(
      checkin.admitWalkIn(A, M, {
        eventId: ev,
        name: "x",
        guestId: new ObjectId().toHexString(),
        arrivedCount: 1,
        clientKey: key(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("finds parties by name or phone, marking who has arrived and who is on the list", async () => {
    const g = await mkGuest("Searchable Sanjay", [ev], { phone: "98765 43210" });
    await checkin.checkInParty(A, M, {
      eventId: ev,
      guestId: g.id,
      arrivedCount: 2,
      clientKey: key(),
    });
    const byName = await checkin.searchParties(A, ev, "searchable");
    expect(byName[0]).toMatchObject({
      name: "Searchable Sanjay",
      invited: true,
      checkedIn: { count: 2 },
    });
    expect((await checkin.searchParties(A, ev, "98765 43210"))[0]?.name).toBe("Searchable Sanjay");
    expect(await checkin.searchParties(A, ev, ".*")).toEqual([]);
  });

  it("the counter adds up arrivals, walk-ins included, against the people expected", async () => {
    await db.collection("checkIns").deleteMany({ weddingId: wA });
    await db.collection("guests").deleteMany({ weddingId: wA });
    const a = await mkGuest("Count A", [ev]);
    const b = await mkGuest("Count B", [ev]);
    await guests.submitRsvp(a.token, ev, { status: "attending", numberAttending: 4 });
    await guests.submitRsvp(b.token, ev, { status: "attending", numberAttending: 3 });
    await checkin.checkInParty(A, M, {
      eventId: ev,
      guestId: a.id,
      arrivedCount: 3,
      clientKey: key(),
    });
    await checkin.admitWalkIn(A, M, {
      eventId: ev,
      name: "Extra",
      arrivedCount: 2,
      clientKey: key(),
    });
    expect(await checkin.getCounter(A, ev)).toEqual({ arrived: 5, arrivedParties: 2, expected: 7 });
  });

  describe("scans made without a signal, sent later", () => {
    it("are checked in with the number they said would come, and replaying the batch changes nothing", async () => {
      const g = await mkGuest("Offline Omar", [ev]);
      await guests.submitRsvp(g.token, ev, { status: "attending", numberAttending: 3 });
      const batch = [{ entryToken: await entryOf(g.id, ev), clientKey: key() }];
      const first = await checkin.syncScans(A, M, ev, batch);
      expect(first).toEqual([
        { clientKey: batch[0]!.clientKey, outcome: "checked_in", name: "Offline Omar", count: 3 },
      ]);
      const replay = await checkin.syncScans(A, M, ev, batch);
      expect(replay[0]).toMatchObject({ outcome: "already", count: 3 });
      expect(
        await db
          .collection("checkIns")
          .countDocuments({ guestId: new ObjectId(g.id), eventId: new ObjectId(ev) }),
      ).toBe(1);
    });

    it("use the typed count when there is one, and the allowance for a party that has not replied", async () => {
      const typed = await mkGuest("Typed Tina", [ev]);
      const silent = await mkGuest("Silent Sam", [ev], { guestsAllowed: 2 });
      const out = await checkin.syncScans(A, M, ev, [
        { entryToken: await entryOf(typed.id, ev), clientKey: key(), arrivedCount: 1 },
        { entryToken: await entryOf(silent.id, ev), clientKey: key() },
      ]);
      expect(out.map((r) => r.count)).toEqual([1, 2]);
    });

    it("answer for every scan, even bad ones, without losing the good ones", async () => {
      const g = await mkGuest("Mixed Mira", [ev]);
      const wrongEvent = await mkGuest("Wrong Event", [other]);
      const out = await checkin.syncScans(A, M, ev, [
        { entryToken: "nothing-like-a-code-123", clientKey: key() },
        { entryToken: await entryOf(wrongEvent.id, other), clientKey: key() },
        { entryToken: await entryOf(g.id, ev), clientKey: key() },
      ]);
      expect(out.map((r) => r.outcome)).toEqual(["unknown", "not_on_list", "checked_in"]);
    });
  });

  it("deleting an event removes its arrivals and tells how many first, leaving other events alone", async () => {
    const doomed = (await mkEvent("Doomed")).id;
    const g = await mkGuest("Doomed Dev", [doomed, other]);
    await checkin.checkInParty(A, M, {
      eventId: doomed,
      guestId: g.id,
      arrivedCount: 2,
      clientKey: key(),
    });
    await checkin.checkInParty(A, M, {
      eventId: other,
      guestId: g.id,
      arrivedCount: 2,
      clientKey: key(),
    });
    expect(await events.previewEventDelete(A, doomed)).toMatchObject({ arrivalCount: 1 });
    await events.deleteEvent(A, doomed);
    expect(await db.collection("checkIns").countDocuments({ eventId: new ObjectId(doomed) })).toBe(
      0,
    );
    expect(
      await db
        .collection("checkIns")
        .countDocuments({ eventId: new ObjectId(other), guestId: new ObjectId(g.id) }),
    ).toBe(1);
  });

  it("an arrival stays on record if the guest is later deleted", async () => {
    const g = await mkGuest("Leaves Lata", [ev]);
    await checkin.checkInParty(A, M, {
      eventId: ev,
      guestId: g.id,
      arrivedCount: 2,
      clientKey: key(),
    });
    const before = (await checkin.getCounter(A, ev)).arrived;
    await guests.deleteGuest(A, g.id);
    expect((await checkin.getCounter(A, ev)).arrived).toBe(before);
  });
});
