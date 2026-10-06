import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMember = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  addTable: vi.fn(),
  assignParty: vi.fn(),
  editTable: vi.fn(),
  getTable: vi.fn(),
  listEventTables: vi.fn(),
  moveParty: vi.fn(),
  removeTable: vi.fn(),
  unassignParty: vi.fn(),
}));
const events = vi.hoisted(() => ({ getEvent: vi.fn(), setEventShowTable: vi.fn() }));
const getGuest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("./service", () => service);
vi.mock("@/modules/events/service", () => events);
vi.mock("@/modules/guests/service", () => ({ getGuest }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  assignPartyAction,
  createTableAction,
  deleteTableAction,
  moveSeatedPartyAction,
  setShowTableAction,
  unassignPartyAction,
  updateTableAction,
} from "./actions";

const E = "507f1f77bcf86cd799439011";
const T1 = "507f1f77bcf86cd799439012";
const T2 = "507f1f77bcf86cd799439014";
const G = "507f1f77bcf86cd799439013";
const table = (id: string, assignments: Array<{ guestId: string; seats: number }> = []) => ({
  id,
  eventId: E,
  name: id === T1 ? "Table 1" : "Table 2",
  capacity: 10,
  assignments,
});
const guest = (over: Record<string, unknown> = {}) => ({
  id: G,
  name: "Rajesh Sharma",
  guestsAllowed: 4,
  invitations: [{ eventId: E, rsvpStatus: "attending", numberAttending: 3 }],
  ...over,
});

beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1" });
  Object.values(service).forEach((fn) => fn.mockReset().mockResolvedValue({ id: "t1" }));
  events.getEvent.mockReset().mockResolvedValue({ id: E });
  events.setEventShowTable.mockReset().mockResolvedValue(undefined);
  getGuest.mockReset().mockResolvedValue(guest());
  service.getTable.mockImplementation(async (_w: string, id: string) => table(id));
  service.listEventTables.mockResolvedValue([table(T1), table(T2)]);
});

describe("tables", () => {
  it("create: in the caller's wedding, for an event that exists", async () => {
    expect(
      await createTableAction({ eventId: E, name: "Table 1", capacity: "10", weddingId: "evil" }),
    ).toEqual({ ok: true, data: { id: "t1" } });
    expect(service.addTable.mock.calls[0]![0]).toBe("w1");
    events.getEvent.mockResolvedValue(null);
    expect(await createTableAction({ eventId: E, name: "Table 2", capacity: 10 })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
  it("update and delete", async () => {
    await updateTableAction({ tableId: T1, name: "Head", capacity: 12 });
    expect(service.editTable).toHaveBeenCalledWith("w1", T1, { name: "Head", capacity: 12 });
    await deleteTableAction({ tableId: T1 });
    expect(service.removeTable).toHaveBeenCalledWith("w1", T1);
  });
});

describe("seating a party", () => {
  it("seats an attending party up to the number it needs", async () => {
    expect(await assignPartyAction({ tableId: T1, guestId: G, seats: 3 })).toMatchObject({
      ok: true,
    });
    expect(service.assignParty).toHaveBeenCalledWith("w1", T1, G, 3);
  });
  it("refuses more seats than the party needs, counting what it has at other tables", async () => {
    service.listEventTables.mockResolvedValue([table(T1), table(T2, [{ guestId: G, seats: 2 }])]);
    const r = await assignPartyAction({ tableId: T1, guestId: G, seats: 2 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(await assignPartyAction({ tableId: T1, guestId: G, seats: 1 })).toMatchObject({
      ok: true,
    });
  });
  it("changing seats at the same table does not count that table twice", async () => {
    service.listEventTables.mockResolvedValue([table(T1, [{ guestId: G, seats: 3 }])]);
    expect(await assignPartyAction({ tableId: T1, guestId: G, seats: 3 })).toMatchObject({
      ok: true,
    });
  });
  it("uses the number allowed for a party that has not replied", async () => {
    getGuest.mockResolvedValue(guest({ invitations: [{ eventId: E, rsvpStatus: "pending" }] }));
    expect(await assignPartyAction({ tableId: T1, guestId: G, seats: 4 })).toMatchObject({
      ok: true,
    });
    expect(await assignPartyAction({ tableId: T1, guestId: G, seats: 5 })).toMatchObject({
      ok: false,
    });
  });
  it("refuses a party not invited to the event, or not coming", async () => {
    getGuest.mockResolvedValue(guest({ invitations: [] }));
    expect(await assignPartyAction({ tableId: T1, guestId: G, seats: 1 })).toMatchObject({
      ok: false,
      error: { code: "NOT_INVITED" },
    });
    getGuest.mockResolvedValue(
      guest({ invitations: [{ eventId: E, rsvpStatus: "not_attending" }] }),
    );
    expect(await assignPartyAction({ tableId: T1, guestId: G, seats: 1 })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    getGuest.mockResolvedValue(null);
    expect(await assignPartyAction({ tableId: T1, guestId: G, seats: 1 })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(service.assignParty).not.toHaveBeenCalled();
  });
  it("refuses a table that is not this wedding's", async () => {
    service.getTable.mockResolvedValue(null);
    expect(await assignPartyAction({ tableId: T1, guestId: G, seats: 1 })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("moving and unseating", () => {
  beforeEach(() => {
    service.getTable.mockImplementation(async (_w: string, id: string) =>
      table(id, id === T1 ? [{ guestId: G, seats: 3 }] : []),
    );
  });
  it("moves a party, keeping its seats unless told otherwise", async () => {
    await moveSeatedPartyAction({ guestId: G, fromTableId: T1, toTableId: T2 });
    expect(service.moveParty).toHaveBeenCalledWith("w1", {
      guestId: G,
      fromTableId: T1,
      toTableId: T2,
      seats: 3,
    });
    await moveSeatedPartyAction({ guestId: G, fromTableId: T1, toTableId: T2, seats: 2 });
    expect(service.moveParty).toHaveBeenLastCalledWith("w1", expect.objectContaining({ seats: 2 }));
  });
  it("refuses moving a party that is not at the first table, or between events", async () => {
    expect(
      await moveSeatedPartyAction({ guestId: G, fromTableId: T2, toTableId: T1 }),
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    service.getTable.mockImplementation(async (_w: string, id: string) => ({
      ...table(id, id === T1 ? [{ guestId: G, seats: 3 }] : []),
      eventId: id === T1 ? E : "507f1f77bcf86cd799439099",
    }));
    expect(
      await moveSeatedPartyAction({ guestId: G, fromTableId: T1, toTableId: T2 }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(service.moveParty).not.toHaveBeenCalled();
  });
  it("unseats a party", async () => {
    await unassignPartyAction({ tableId: T1, guestId: G });
    expect(service.unassignParty).toHaveBeenCalledWith("w1", T1, G);
  });
});

describe("show the table to guests", () => {
  it("is set for the caller's wedding", async () => {
    await setShowTableAction({ eventId: E, on: true });
    expect(events.setEventShowTable).toHaveBeenCalledWith("w1", E, true);
  });
});

describe("every action needs a signed-in member", () => {
  it("refuses an anonymous caller", async () => {
    const { AppError } = await import("@/lib/errors");
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    for (const result of [
      await createTableAction({ eventId: E, name: "T", capacity: 5 }),
      await updateTableAction({ tableId: T1, name: "T", capacity: 5 }),
      await deleteTableAction({ tableId: T1 }),
      await assignPartyAction({ tableId: T1, guestId: G, seats: 1 }),
      await moveSeatedPartyAction({ guestId: G, fromTableId: T1, toTableId: T2 }),
      await unassignPartyAction({ tableId: T1, guestId: G }),
      await setShowTableAction({ eventId: E, on: true }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(Object.values(service).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
});
