import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMember = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  createGuest: vi.fn(),
  updateGuest: vi.fn(),
  deleteGuest: vi.fn(),
  findPhoneDuplicate: vi.fn(),
  overrideRsvp: vi.fn(),
  recordWhatsappShare: vi.fn(),
}));
const getEventsByIds = vi.hoisted(() => vi.fn());
const setWhatsappMessage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("./service", () => service);
vi.mock("@/modules/events/service", () => ({ getEventsByIds }));
vi.mock("@/modules/wedding/service", () => ({ setWhatsappMessage }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  checkPhoneAction,
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
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(Object.values(service).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
});
