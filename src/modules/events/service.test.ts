import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  deleteEvent: vi.fn(),
  findEvent: vi.fn(),
  insertEvent: vi.fn(),
  listEvents: vi.fn(),
  replaceEventFields: vi.fn(),
}));
const tasks = vi.hoisted(() => ({ taskCountForEvent: vi.fn(), unlinkEvent: vi.fn() }));
const guests = vi.hoisted(() => ({
  countGuestsInvitedToEvent: vi.fn(),
  removeEventInvitations: vi.fn(),
}));
const money = vi.hoisted(() => ({ countExpensesForEvent: vi.fn(), unlinkEventFromMoney: vi.fn() }));
const vendors = vi.hoisted(() => ({
  countVendorsForEvent: vi.fn(),
  removeEventFromVendors: vi.fn(),
}));
const seating = vi.hoisted(() => ({ countTablesForEvent: vi.fn(), removeEventTables: vi.fn() }));
const photos = vi.hoisted(() => ({ removeEventAlbum: vi.fn() }));
const checkin = vi.hoisted(() => ({
  countArrivalsForEvent: vi.fn(),
  removeEventArrivals: vi.fn(),
}));
const inTransaction = vi.hoisted(() => vi.fn());
vi.mock("./repository", () => repo);
vi.mock("@/modules/tasks/service", () => tasks);
vi.mock("@/modules/guests/service", () => guests);
vi.mock("@/modules/money/service", () => money);
vi.mock("@/modules/vendors/service", () => vendors);
vi.mock("@/modules/seating/service", () => seating);
vi.mock("@/modules/checkin/service", () => checkin);
vi.mock("@/modules/photos/service", () => photos);
vi.mock("@/lib/db", () => ({ inTransaction }));

import { createEvent, deleteEvent, previewEventDelete, updateEvent } from "./service";
import { eventInputSchema } from "./schema";

const input = (over = {}) =>
  eventInputSchema.parse({
    type: "sangeet",
    name: "Sangeet",
    date: "2027-02-13",
    startTime: "19:00",
    ...over,
  });
const session = { id: "session" };

beforeEach(() => {
  Object.values(repo).forEach((fn) => fn.mockReset());
  Object.values(tasks).forEach((fn) => fn.mockReset());
  Object.values(guests).forEach((fn) => fn.mockReset());
  Object.values(money).forEach((fn) => fn.mockReset());
  Object.values(vendors).forEach((fn) => fn.mockReset());
  Object.values(seating).forEach((fn) => fn.mockReset());
  Object.values(checkin).forEach((fn) => fn.mockReset());
  Object.values(photos).forEach((fn) => fn.mockReset());
  inTransaction.mockReset().mockImplementation((work) => work(session));
});

describe("saving events", () => {
  it("stores the date as midnight in India", async () => {
    repo.insertEvent.mockImplementation(async (_w, fields) => ({
      _id: { toHexString: () => "e1" },
      ...fields,
    }));
    await createEvent("w1", input());
    expect(repo.insertEvent.mock.calls[0]![1].date.toISOString()).toBe("2027-02-12T18:30:00.000Z");
  });

  it("removes optional fields that were cleared", async () => {
    repo.replaceEventFields.mockResolvedValue({
      _id: { toHexString: () => "e1" },
      date: new Date(),
    });
    await updateEvent("w1", "507f1f77bcf86cd799439011", input({ venueName: "Royal Garden" }));
    const [, , set, unset] = repo.replaceEventFields.mock.calls[0]!;
    expect(set.venueName).toBe("Royal Garden");
    expect(unset).toEqual(["endTime", "address", "description", "dressCode"]);
  });

  it("reports NOT_FOUND when the event is not in this wedding", async () => {
    repo.replaceEventFields.mockResolvedValue(null);
    await expect(updateEvent("w1", "507f1f77bcf86cd799439011", input())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("deleting an event", () => {
  it("previews how many tasks and guests are linked", async () => {
    repo.findEvent.mockResolvedValue({});
    tasks.taskCountForEvent.mockResolvedValue(3);
    guests.countGuestsInvitedToEvent.mockResolvedValue(12);
    money.countExpensesForEvent.mockResolvedValue(5);
    vendors.countVendorsForEvent.mockResolvedValue(2);
    seating.countTablesForEvent.mockResolvedValue(4);
    checkin.countArrivalsForEvent.mockResolvedValue(9);
    expect(await previewEventDelete("w1", "e1")).toEqual({
      taskCount: 3,
      guestCount: 12,
      expenseCount: 5,
      vendorCount: 2,
      tableCount: 4,
      arrivalCount: 9,
    });
  });

  it("deletes the event, its invitations and unlinks its tasks in one transaction", async () => {
    repo.deleteEvent.mockResolvedValue(true);
    await deleteEvent("w1", "e1");
    expect(guests.removeEventInvitations).toHaveBeenCalledWith("w1", "e1", { session });
    expect(money.unlinkEventFromMoney).toHaveBeenCalledWith("w1", "e1", { session });
    expect(vendors.removeEventFromVendors).toHaveBeenCalledWith("w1", "e1", { session });
    expect(seating.removeEventTables).toHaveBeenCalledWith("w1", "e1", { session });
    expect(checkin.removeEventArrivals).toHaveBeenCalledWith("w1", "e1", { session });
    expect(photos.removeEventAlbum).toHaveBeenCalledWith("w1", "e1", { session });
    expect(repo.deleteEvent).toHaveBeenCalledWith("w1", "e1", { session });
    expect(tasks.unlinkEvent).toHaveBeenCalledWith("w1", "e1", { session });
  });

  it("changes nothing for an event that does not exist", async () => {
    repo.deleteEvent.mockResolvedValue(false);
    await expect(deleteEvent("w1", "e1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(tasks.unlinkEvent).not.toHaveBeenCalled();
    expect(guests.removeEventInvitations).not.toHaveBeenCalled();
    expect(money.unlinkEventFromMoney).not.toHaveBeenCalled();
    expect(vendors.removeEventFromVendors).not.toHaveBeenCalled();
    expect(seating.removeEventTables).not.toHaveBeenCalled();
    expect(checkin.removeEventArrivals).not.toHaveBeenCalled();
    expect(photos.removeEventAlbum).not.toHaveBeenCalled();
  });
});
