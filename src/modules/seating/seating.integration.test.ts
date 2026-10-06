import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): seating tables and assignments on the real database, with two
// throwaway weddings removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("seating against MongoDB", () => {
  let seating: typeof import("./service");
  let plan: typeof import("./plan");
  let guests: typeof import("@/modules/guests/service");
  let guestSchema: typeof import("@/modules/guests/schema");
  let events: typeof import("@/modules/events/service");
  let eventSchema: typeof import("@/modules/events/schema");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();
  let ev: string;
  let ev2: string;

  const mkGuest = (name: string, allowed = 4, event = ev) =>
    guests.createGuest(
      A,
      guestSchema.guestInputSchema.parse({
        name,
        guestsAllowed: allowed,
        invitedEventIds: [event],
      }),
    );
  const clean = () =>
    Promise.all(
      ["seatingTables", "guests", "events"].map((n) =>
        db.collection(n).deleteMany({ weddingId: { $in: [wA, wB] } }),
      ),
    );

  beforeAll(async () => {
    seating = await import("./service");
    plan = await import("./plan");
    guests = await import("@/modules/guests/service");
    guestSchema = await import("@/modules/guests/schema");
    events = await import("@/modules/events/service");
    eventSchema = await import("@/modules/events/schema");
    db = await (await import("@/lib/db")).getDb();
    await seating.listEventTables(A, new ObjectId().toHexString());
    await guests.listGuests(A, { page: 1 });
    await events.listEvents(A);
    await clean();
    const mkEvent = (name: string) =>
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name,
        date: "2099-02-13",
        startTime: "19:00",
      });
    ev = (await events.createEvent(A, mkEvent("Sangeet"))).id;
    ev2 = (await events.createEvent(A, mkEvent("Wedding"))).id;
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("a table starts empty; a name is used once per event, but can be reused for another event", async () => {
    const t = await seating.addTable(A, { eventId: ev, name: "Table 1", capacity: 10 });
    expect(t).toMatchObject({ name: "Table 1", capacity: 10, assignments: [] });
    await expect(
      seating.addTable(A, { eventId: ev, name: "table 1", capacity: 8 }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      seating.addTable(A, { eventId: ev2, name: "Table 1", capacity: 8 }),
    ).resolves.toBeTruthy();
  });

  it("tables are listed in natural order, so Table 2 comes before Table 10", async () => {
    await seating.addTable(A, { eventId: ev, name: "Table 10", capacity: 4 });
    await seating.addTable(A, { eventId: ev, name: "Table 2", capacity: 4 });
    const names = (await seating.listEventTables(A, ev)).map((t) => t.name);
    expect(names.indexOf("Table 2")).toBeLessThan(names.indexOf("Table 10"));
  });

  it("one wedding never sees or changes another wedding's tables", async () => {
    const t = await seating.addTable(A, { eventId: ev, name: "Only A", capacity: 6 });
    const g = await mkGuest("Scoped Sam");
    expect(await seating.listEventTables(B, ev)).toEqual([]);
    expect(await seating.getTable(B, t.id)).toBeNull();
    await expect(seating.editTable(B, t.id, { name: "Hacked", capacity: 1 })).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
    await expect(seating.removeTable(B, t.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(seating.assignParty(B, t.id, g.id, 1)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await seating.getTable(A, t.id))?.name).toBe("Only A");
  });

  it("seats a party, and seating it again at the same table changes its seats rather than adding a second entry", async () => {
    const t = await seating.addTable(A, { eventId: ev, name: "Change", capacity: 10 });
    const g = await mkGuest("Change Chitra");
    await seating.assignParty(A, t.id, g.id, 3);
    await seating.assignParty(A, t.id, g.id, 2);
    const saved = await seating.getTable(A, t.id);
    expect(saved?.assignments).toEqual([{ guestId: g.id, seats: 2 }]);
  });

  it("refuses a party that does not fit, saying how many seats are free, and changes nothing", async () => {
    const t = await seating.addTable(A, { eventId: ev, name: "Small", capacity: 4 });
    const a = await mkGuest("Fit Fatima");
    const b = await mkGuest("Fit Farid");
    await seating.assignParty(A, t.id, a.id, 3);
    await expect(seating.assignParty(A, t.id, b.id, 2)).rejects.toMatchObject({
      code: "TABLE_FULL",
      message: expect.stringContaining("1 seat free"),
    });
    expect((await seating.getTable(A, t.id))?.assignments).toEqual([{ guestId: a.id, seats: 3 }]);
    // Growing a party already seated counts only the extra, not the seats it already has.
    await expect(seating.assignParty(A, t.id, a.id, 4)).resolves.toBeUndefined();
    await expect(seating.assignParty(A, t.id, a.id, 5)).rejects.toMatchObject({
      code: "TABLE_FULL",
    });
  });

  it("many people seating at the same moment can never overfill a table", async () => {
    const t = await seating.addTable(A, { eventId: ev, name: "Race", capacity: 10 });
    const many = await Promise.all(Array.from({ length: 8 }, (_, i) => mkGuest(`Racer ${i}`)));
    const results = await Promise.allSettled(
      many.map((g) => seating.assignParty(A, t.id, g.id, 3)),
    );
    const saved = await seating.getTable(A, t.id);
    const used = saved!.assignments.reduce((s, a) => s + a.seats, 0);
    expect(used).toBeLessThanOrEqual(10);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(saved!.assignments.length);
    expect(saved!.assignments.length).toBe(3); // 3 x 3 = 9 fit; a fourth would be 12
    for (const r of results.filter((x) => x.status === "rejected"))
      expect((r as PromiseRejectedResult).reason).toMatchObject({ code: "TABLE_FULL" });
  });

  it("moving a party goes all the way or not at all", async () => {
    const from = await seating.addTable(A, { eventId: ev, name: "Move from", capacity: 10 });
    const to = await seating.addTable(A, { eventId: ev, name: "Move to", capacity: 3 });
    const g = await mkGuest("Mover Maya");
    await seating.assignParty(A, from.id, g.id, 4);

    // The destination is too small: the party must still be at its old table.
    await expect(
      seating.moveParty(A, { guestId: g.id, fromTableId: from.id, toTableId: to.id, seats: 4 }),
    ).rejects.toMatchObject({ code: "TABLE_FULL" });
    expect((await seating.getTable(A, from.id))?.assignments).toEqual([
      { guestId: g.id, seats: 4 },
    ]);
    expect((await seating.getTable(A, to.id))?.assignments).toEqual([]);

    await seating.moveParty(A, { guestId: g.id, fromTableId: from.id, toTableId: to.id, seats: 3 });
    expect((await seating.getTable(A, from.id))?.assignments).toEqual([]);
    expect((await seating.getTable(A, to.id))?.assignments).toEqual([{ guestId: g.id, seats: 3 }]);
    await expect(
      seating.moveParty(A, { guestId: g.id, fromTableId: from.id, toTableId: to.id, seats: 3 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a party can be split across two tables, and each table's name is found for the guest's page", async () => {
    const t1 = await seating.addTable(A, { eventId: ev, name: "Split A", capacity: 10 });
    const t2 = await seating.addTable(A, { eventId: ev, name: "Split B", capacity: 10 });
    const g = await mkGuest("Split Sita");
    await seating.assignParty(A, t1.id, g.id, 2);
    await seating.assignParty(A, t2.id, g.id, 2);
    expect((await seating.tableNamesForParty(A, g.id)).get(ev)).toEqual(["Split A", "Split B"]);
    expect((await seating.tableNamesForParty(B, g.id)).size).toBe(0);
  });

  it("unseating, and deleting a table, leaves the parties unseated", async () => {
    const t = await seating.addTable(A, { eventId: ev, name: "Doomed", capacity: 10 });
    const g = await mkGuest("Doomed Dev", 2);
    await guests.submitRsvp(g.token, ev, { status: "attending", numberAttending: 2 });
    await seating.assignParty(A, t.id, g.id, 2);
    await seating.unassignParty(A, t.id, g.id);
    await expect(seating.unassignParty(A, t.id, g.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await seating.assignParty(A, t.id, g.id, 2);
    await seating.removeTable(A, t.id);
    const p = await plan.getSeatingPlan(A, ev);
    expect(p.unseated.some((u) => u.party.id === g.id && u.remaining === 2)).toBe(true);
  });

  it("the plan reads the guest list: attending, waiting and not coming are told apart", async () => {
    const t = await seating.addTable(A, { eventId: ev, name: "Plan", capacity: 20 });
    const yes = await mkGuest("Plan Yes", 5);
    const no = await mkGuest("Plan No", 5);
    const wait = await mkGuest("Plan Wait", 2);
    await guests.submitRsvp(yes.token, ev, { status: "attending", numberAttending: 3 });
    await guests.submitRsvp(no.token, ev, { status: "not_attending" });
    await seating.assignParty(A, t.id, yes.id, 3);
    const p = await plan.getSeatingPlan(A, ev);
    const planned = p.tables.find((x) => x.table.id === t.id)!;
    expect(planned.seated.map((s) => [s.party.name, s.seats])).toEqual([["Plan Yes", 3]]);
    expect(p.unseated.some((u) => u.party.id === yes.id)).toBe(false);
    expect(p.unseated.some((u) => u.party.id === no.id)).toBe(false);
    expect(p.awaitingReply.find((u) => u.party.id === wait.id)).toMatchObject({ need: 2 });
  });

  it("a guest who is deleted, or taken off the event, gives up their seats", async () => {
    const t = await seating.addTable(A, { eventId: ev, name: "Cleanup", capacity: 20 });
    const gone = await mkGuest("Cleanup Gone", 2);
    const removed = await mkGuest("Cleanup Removed", 2);
    const kept = await mkGuest("Cleanup Kept", 2);
    await seating.assignParty(A, t.id, gone.id, 2);
    await seating.assignParty(A, t.id, removed.id, 2);
    await seating.assignParty(A, t.id, kept.id, 2);

    await guests.deleteGuest(A, gone.id);
    await guests.updateGuest(
      A,
      removed.id,
      guestSchema.guestInputSchema.parse({
        name: "Cleanup Removed",
        guestsAllowed: 2,
        invitedEventIds: [ev2],
      }),
    );

    expect((await seating.getTable(A, t.id))?.assignments.map((a) => a.guestId)).toEqual([kept.id]);
  });

  it("deleting an event takes its tables with it, and only its own", async () => {
    const doomed = (
      await events.createEvent(
        A,
        eventSchema.eventInputSchema.parse({
          type: "custom",
          name: "Doomed event",
          date: "2099-03-01",
          startTime: "10:00",
        }),
      )
    ).id;
    await seating.addTable(A, { eventId: doomed, name: "Gone 1", capacity: 5 });
    await seating.addTable(A, { eventId: doomed, name: "Gone 2", capacity: 5 });
    const before = (await seating.listEventTables(A, ev)).length;
    expect(await events.previewEventDelete(A, doomed)).toMatchObject({ tableCount: 2 });
    await events.deleteEvent(A, doomed);
    expect(await seating.listEventTables(A, doomed)).toEqual([]);
    expect((await seating.listEventTables(A, ev)).length).toBe(before);
  });

  it("the show-table switch is per event, off by default, and stays put when the event is edited", async () => {
    expect((await events.getEvent(A, ev))?.showTable).toBe(false);
    await events.setEventShowTable(A, ev, true);
    expect((await events.getEvent(A, ev))?.showTable).toBe(true);
    await events.updateEvent(
      A,
      ev,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name: "Sangeet",
        date: "2099-02-13",
        startTime: "20:00",
      }),
    );
    expect((await events.getEvent(A, ev))?.showTable).toBe(true);
    await expect(events.setEventShowTable(B, ev, false)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await events.getEvent(A, ev))?.showTable).toBe(true);
  });
});
