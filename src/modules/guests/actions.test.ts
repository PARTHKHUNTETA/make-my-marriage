import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMember = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  createGuest: vi.fn(),
  updateGuest: vi.fn(),
  deleteGuest: vi.fn(),
  createGuests: vi.fn(),
  phonesInUse: vi.fn(),
  findPhoneDuplicate: vi.fn(),
  overrideRsvp: vi.fn(),
  recordWhatsappShare: vi.fn(),
}));
const getEventsByIds = vi.hoisted(() => vi.fn());
const listEvents = vi.hoisted(() => vi.fn());
const setWhatsappMessage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("./service", () => service);
vi.mock("@/modules/events/service", () => ({ getEventsByIds, listEvents }));
vi.mock("@/modules/wedding/service", () => ({ setWhatsappMessage }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  checkPhoneAction,
  confirmGuestImportAction,
  previewGuestImportAction,
  createGuestAction,
  deleteGuestAction,
  overrideRsvpAction,
  recordWhatsappShareAction,
  saveWhatsappMessageAction,
  updateGuestAction,
} from "./actions";

const G = "507f1f77bcf86cd799439011";
const E1 = "507f1f77bcf86cd799439012";
const E2 = "507f1f77bcf86cd799439013";
const valid = { name: "Rajesh", guestsAllowed: 2, invitedEventIds: [E1] };

beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1", memberId: "m1" });
  Object.values(service).forEach((fn) => fn.mockReset().mockResolvedValue({ id: "g1" }));
  getEventsByIds.mockReset().mockResolvedValue([{ id: E1 }]);
  listEvents.mockReset().mockResolvedValue([{ id: E1, name: "Wedding" }]);
  service.phonesInUse.mockResolvedValue(new Map());
  setWhatsappMessage.mockReset().mockResolvedValue(undefined);
});

describe("guest actions", () => {
  it("create: uses the caller's wedding and returns the new id", async () => {
    expect(await createGuestAction({ ...valid, weddingId: "evil" })).toEqual({
      ok: true,
      data: { id: "g1" },
    });
    expect(service.createGuest.mock.calls[0]![0]).toBe("w1");
  });

  it("create and update: refuse an event that is not in this wedding", async () => {
    getEventsByIds.mockResolvedValue([]);
    for (const result of [
      await createGuestAction(valid),
      await updateGuestAction({ guestId: G, ...valid }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(getEventsByIds).toHaveBeenCalledWith("w1", [E1]);
    expect(service.createGuest).not.toHaveBeenCalled();
    expect(service.updateGuest).not.toHaveBeenCalled();
  });

  it("counts a duplicated event id once", async () => {
    await createGuestAction({ ...valid, invitedEventIds: [E1, E1] });
    expect(service.createGuest).toHaveBeenCalled();
    getEventsByIds.mockResolvedValue([{ id: E1 }]);
    expect(await createGuestAction({ ...valid, invitedEventIds: [E1, E2] })).toMatchObject({
      ok: false,
    });
  });

  it("validates input before touching anything", async () => {
    expect(await createGuestAction({ ...valid, name: "" })).toMatchObject({ ok: false });
    expect(await deleteGuestAction({ guestId: "nope" })).toMatchObject({ ok: false });
    expect(
      await overrideRsvpAction({ guestId: G, eventId: E1, status: "attending" }),
    ).toMatchObject({
      ok: false,
    });
    expect(service.createGuest).not.toHaveBeenCalled();
    expect(service.overrideRsvp).not.toHaveBeenCalled();
  });

  it("override: passes the wedding from the session, not the input", async () => {
    await overrideRsvpAction({ guestId: G, eventId: E1, status: "attending", numberAttending: 2 });
    expect(service.overrideRsvp).toHaveBeenCalledWith("w1", G, E1, {
      status: "attending",
      numberAttending: 2,
    });
  });

  it("phone check: reports who already has the number, and is quiet for a bad number", async () => {
    service.findPhoneDuplicate.mockResolvedValue("Rajesh Sharma");
    expect(await checkPhoneAction({ phone: "98765 43210" })).toEqual({
      ok: true,
      data: { duplicateOf: "Rajesh Sharma" },
    });
    expect(service.findPhoneDuplicate).toHaveBeenCalledWith("w1", "+919876543210", undefined);
    service.findPhoneDuplicate.mockClear();
    expect(await checkPhoneAction({ phone: "12" })).toEqual({
      ok: true,
      data: { duplicateOf: null },
    });
    expect(service.findPhoneDuplicate).not.toHaveBeenCalled();
  });

  it("whatsapp: records the share and saves the message with a length cap", async () => {
    await recordWhatsappShareAction({ guestId: G });
    expect(service.recordWhatsappShare).toHaveBeenCalledWith("w1", G);
    expect(await saveWhatsappMessageAction({ message: "Namaste {name} {link}" })).toMatchObject({
      ok: true,
    });
    expect(setWhatsappMessage).toHaveBeenCalledWith("w1", "Namaste {name} {link}");
    expect(await saveWhatsappMessageAction({ message: "x".repeat(601) })).toMatchObject({
      ok: false,
    });
  });

  describe("bulk import", () => {
    const table = [
      ["Name", "Phone", "Email", "Guests allowed", "Invited events"],
      ["Rajesh Sharma", "98765 43210", "", "4", "Wedding"],
      ["Bad Row", "", "", "x", "Wedding"],
    ];

    it("preview: describes each row and never sends the parsed guest back", async () => {
      const result = await previewGuestImportAction({ table });
      expect(result).toMatchObject({
        ok: true,
        data: { summary: { total: 2, ok: 1, error: 1 } },
      });
      if (result.ok) expect(result.data.rows.every((r) => r.input === undefined)).toBe(true);
      expect(service.createGuests).not.toHaveBeenCalled();
    });

    it("confirm: creates only the valid rows, in the caller's wedding", async () => {
      service.createGuests.mockResolvedValue(1);
      expect(await confirmGuestImportAction({ table })).toEqual({
        ok: true,
        data: { imported: 1, skipped: 1 },
      });
      const [wedding, guests] = service.createGuests.mock.calls[0]!;
      expect(wedding).toBe("w1");
      expect(guests).toHaveLength(1);
      expect(guests[0]).toMatchObject({ name: "Rajesh Sharma", phone: "+919876543210" });
    });

    it("confirm: skips duplicate phones unless asked", async () => {
      service.phonesInUse.mockResolvedValue(new Map([["+919876543210", "Someone"]]));
      service.createGuests.mockResolvedValue(0);
      await confirmGuestImportAction({ table });
      expect(service.createGuests).not.toHaveBeenCalled(); // nothing valid and not duplicate
      service.createGuests.mockResolvedValue(1);
      await confirmGuestImportAction({ table, includeDuplicates: true });
      expect(service.createGuests.mock.calls[0]![1]).toHaveLength(1);
    });

    it("refuses a file with the wrong columns, no events, or too many rows", async () => {
      expect(await previewGuestImportAction({ table: [["Foo"], ["x"]] })).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
      listEvents.mockResolvedValue([]);
      expect(await previewGuestImportAction({ table })).toMatchObject({ ok: false });
      expect(
        await previewGuestImportAction({ table: Array.from({ length: 1002 }, () => ["x"]) }),
      ).toMatchObject({ ok: false });
    });
  });

  it("every action needs a signed-in member", async () => {
    const { AppError } = await import("@/lib/errors");
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    for (const result of [
      await createGuestAction(valid),
      await updateGuestAction({ guestId: G, ...valid }),
      await deleteGuestAction({ guestId: G }),
      await checkPhoneAction({ phone: "9876543210" }),
      await recordWhatsappShareAction({ guestId: G }),
      await overrideRsvpAction({ guestId: G, eventId: E1, status: "not_attending" }),
      await saveWhatsappMessageAction({ message: "x" }),
      await previewGuestImportAction({ table: [["Name"]] }),
      await confirmGuestImportAction({ table: [["Name"]] }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(Object.values(service).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
});
