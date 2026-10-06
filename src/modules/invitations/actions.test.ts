import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMember = vi.hoisted(() => vi.fn());
const sending = vi.hoisted(() => ({
  sendInvitationEmails: vi.fn(),
  sendRsvpReminderEmails: vi.fn(),
}));
const setReminderSettings = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("./sending", () => sending);
vi.mock("@/modules/wedding/service", () => ({ setReminderSettings }));
vi.mock("@/lib/ratelimit", () => ({
  consumeRateLimit,
  subjectKey: (a: string, b: string) => `${a}:${b}`,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveReminderSettingsAction, sendInvitationsAction, sendRemindersAction } from "./actions";

const G = "507f1f77bcf86cd799439011";

beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1" });
  Object.values(sending).forEach((fn) => fn.mockReset().mockResolvedValue({ queued: 2 }));
  setReminderSettings.mockReset().mockResolvedValue(undefined);
  consumeRateLimit.mockReset().mockResolvedValue(undefined);
});

describe("email actions", () => {
  it("send invitations for the caller's wedding to chosen guests or everyone", async () => {
    expect(await sendInvitationsAction({ guestIds: [G] })).toEqual({
      ok: true,
      data: { queued: 2 },
    });
    expect(sending.sendInvitationEmails).toHaveBeenCalledWith("w1", { guestIds: [G] });
    await sendInvitationsAction({ all: true, weddingId: "evil" });
    expect(sending.sendInvitationEmails).toHaveBeenLastCalledWith("w1", { all: true });
  });

  it("send reminders to non-responders or chosen guests", async () => {
    await sendRemindersAction({ nonResponders: true });
    expect(sending.sendRsvpReminderEmails).toHaveBeenCalledWith("w1", { nonResponders: true });
  });

  it("refuse bad input and rate-limited senders before sending anything", async () => {
    expect(await sendInvitationsAction({ guestIds: [] })).toMatchObject({ ok: false });
    expect(await sendInvitationsAction({ guestIds: ["nope"] })).toMatchObject({ ok: false });
    expect(await sendRemindersAction({})).toMatchObject({ ok: false });
    const { AppError } = await import("@/lib/errors");
    consumeRateLimit.mockRejectedValue(new AppError("RATE_LIMITED", "Slow down"));
    expect(await sendInvitationsAction({ all: true })).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(sending.sendInvitationEmails).not.toHaveBeenCalled();
  });

  it("save reminder settings: parses the days text and stores them sorted", async () => {
    expect(await saveReminderSettingsAction({ enabled: true, days: "3, 14" })).toEqual({
      ok: true,
      data: { enabled: true, rsvpDays: [14, 3] },
    });
    expect(setReminderSettings).toHaveBeenCalledWith("w1", { enabled: true, rsvpDays: [14, 3] });
    expect(await saveReminderSettingsAction({ enabled: true, days: "soon" })).toMatchObject({
      ok: false,
    });
    expect(await saveReminderSettingsAction({ enabled: true, days: "" })).toMatchObject({
      ok: false,
    });
  });

  it("every action needs a signed-in member", async () => {
    const { AppError } = await import("@/lib/errors");
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    for (const result of [
      await sendInvitationsAction({ all: true }),
      await sendRemindersAction({ nonResponders: true }),
      await saveReminderSettingsAction({ enabled: true, days: "3" }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(sending.sendInvitationEmails).not.toHaveBeenCalled();
    expect(setReminderSettings).not.toHaveBeenCalled();
  });
});
