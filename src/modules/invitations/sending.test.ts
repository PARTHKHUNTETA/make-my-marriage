import { beforeEach, describe, expect, it, vi } from "vitest";

const queueEmail = vi.hoisted(() => vi.fn());
const guestsSvc = vi.hoisted(() => ({
  getGuestByToken: vi.fn(),
  getGuestsByIds: vi.fn(),
  listEveryGuest: vi.fn(),
  recordInviteEmailed: vi.fn(),
  setGuestUnsubscribed: vi.fn(),
}));
const eventsSvc = vi.hoisted(() => ({ listEvents: vi.fn() }));
const weddingSvc = vi.hoisted(() => ({ getWedding: vi.fn(), listRemindingWeddings: vi.fn() }));
vi.mock("@/lib/email", () => ({ queueEmail, deliverJob: vi.fn() }));
vi.mock("@/lib/queue", () => ({
  drainEmailQueue: vi.fn().mockResolvedValue({}),
  listEmailLog: vi.fn(),
}));
vi.mock("@/lib/app-url", () => ({ absoluteUrl: (p: string) => `http://app.test${p}` }));
vi.mock("@/modules/guests/service", () => guestsSvc);
vi.mock("@/modules/events/service", () => eventsSvc);
vi.mock("@/modules/wedding/service", () => weddingSvc);

import {
  runAutomaticReminders,
  sendInvitationEmails,
  sendRsvpReminderEmails,
  setUnsubscribed,
} from "./sending";

const day = (ymd: string, time = "00:00") => new Date(`${ymd}T${time}:00+05:30`);
const ev = (id: string, name: string, ymd: string) => ({
  id,
  name,
  date: day(ymd),
  startTime: "19:00",
  type: "custom",
  showOnWebsite: true,
  venueName: "Royal Garden",
});
const guest = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Guest ${id}`,
  email: `${id}@example.com`,
  guestsAllowed: 2,
  token: `token-${id}`,
  remindersUnsubscribed: false,
  invitations: [{ eventId: "e1", rsvpStatus: "pending" }],
  ...over,
});
const now = new Date("2027-02-01T10:00:00+05:30");

beforeEach(() => {
  queueEmail.mockReset().mockResolvedValue(true);
  Object.values(guestsSvc).forEach((fn) => fn.mockReset());
  guestsSvc.recordInviteEmailed.mockResolvedValue(undefined);
  eventsSvc.listEvents
    .mockReset()
    .mockResolvedValue([ev("e1", "Sangeet", "2027-02-13"), ev("e2", "Wedding", "2027-02-14")]);
  weddingSvc.getWedding.mockReset().mockResolvedValue({ brideName: "Priya", groomName: "Aarav" });
  weddingSvc.listRemindingWeddings.mockReset();
});

describe("sendInvitationEmails", () => {
  it("queues one invitation per guest with an email, keyed once a day, and records it", async () => {
    guestsSvc.listEveryGuest.mockResolvedValue([guest("a"), guest("b", { email: undefined })]);
    const result = await sendInvitationEmails("w1", { all: true }, now);
    expect(result).toMatchObject({ queued: 1, noEmail: 1, alreadyToday: 0 });
    const job = queueEmail.mock.calls[0]![0];
    expect(job).toMatchObject({
      type: "invitation",
      toEmail: "a@example.com",
      weddingId: "w1",
      dedupeKey: "invite:a:2027-02-01",
      meta: { guestId: "a" },
    });
    expect(job.payload.url).toBe("http://app.test/i/token-a");
    expect(JSON.parse(job.payload.events)[0]).toMatchObject({
      name: "Sangeet",
      venue: "Royal Garden",
    });
    expect(guestsSvc.recordInviteEmailed).toHaveBeenCalledWith("w1", ["a"]);
  });

  it("only lists the events the guest is invited to", async () => {
    guestsSvc.listEveryGuest.mockResolvedValue([
      guest("a", { invitations: [{ eventId: "e2", rsvpStatus: "pending" }] }),
    ]);
    await sendInvitationEmails("w1", { all: true }, now);
    expect(
      JSON.parse(queueEmail.mock.calls[0]![0].payload.events).map((e: { name: string }) => e.name),
    ).toEqual(["Wedding"]);
  });

  it("counts a guest already emailed today instead of sending twice", async () => {
    guestsSvc.listEveryGuest.mockResolvedValue([guest("a")]);
    queueEmail.mockResolvedValue(false);
    expect(await sendInvitationEmails("w1", { all: true }, now)).toMatchObject({
      queued: 0,
      alreadyToday: 1,
    });
    expect(guestsSvc.recordInviteEmailed).toHaveBeenCalledWith("w1", []);
  });

  it("uses only the chosen guests when given ids", async () => {
    guestsSvc.getGuestsByIds.mockResolvedValue([guest("a")]);
    await sendInvitationEmails("w1", { guestIds: ["a"] }, now);
    expect(guestsSvc.getGuestsByIds).toHaveBeenCalledWith("w1", ["a"]);
    expect(guestsSvc.listEveryGuest).not.toHaveBeenCalled();
  });
});

describe("sendRsvpReminderEmails", () => {
  it("reminds guests who owe a reply, with an unsubscribe link, once a day", async () => {
    guestsSvc.listEveryGuest.mockResolvedValue([guest("a")]);
    const result = await sendRsvpReminderEmails("w1", { nonResponders: true }, now);
    expect(result.queued).toBe(1);
    const job = queueEmail.mock.calls[0]![0];
    expect(job).toMatchObject({ type: "rsvp_reminder", dedupeKey: "remind:a:2027-02-01" });
    expect(job.payload.unsubscribeUrl).toBe("http://app.test/unsubscribe/token-a");
  });

  it("skips guests who replied, unsubscribed, or have no email, and says why", async () => {
    guestsSvc.listEveryGuest.mockResolvedValue([
      guest("replied", { invitations: [{ eventId: "e1", rsvpStatus: "attending" }] }),
      guest("unsub", { remindersUnsubscribed: true }),
      guest("noemail", { email: undefined }),
    ]);
    const result = await sendRsvpReminderEmails("w1", { nonResponders: true }, now);
    expect(result).toMatchObject({ queued: 0, unsubscribed: 1, noEmail: 1 });
    expect(queueEmail).not.toHaveBeenCalled();
  });

  it("does not ask about an event that has already started", async () => {
    guestsSvc.listEveryGuest.mockResolvedValue([guest("a")]);
    const late = new Date("2027-02-13T20:00:00+05:30");
    expect((await sendRsvpReminderEmails("w1", { nonResponders: true }, late)).queued).toBe(0);
  });

  it("reports chosen guests with nothing left to answer", async () => {
    guestsSvc.getGuestsByIds.mockResolvedValue([
      guest("a", { invitations: [{ eventId: "e1", rsvpStatus: "not_attending" }] }),
    ]);
    expect(await sendRsvpReminderEmails("w1", { guestIds: ["a"] }, now)).toMatchObject({
      queued: 0,
      nothingToSend: 1,
    });
  });
});

describe("runAutomaticReminders", () => {
  it("queues what is due today, one per guest per day, only for weddings that turned it on", async () => {
    weddingSvc.listRemindingWeddings.mockResolvedValue([
      { id: "w1", couple: "Priya & Aarav", reminders: { enabled: true, rsvpDays: [12] } },
    ]);
    guestsSvc.listEveryGuest.mockResolvedValue([
      guest("a"), // pending for the Sangeet, 12 days away: due
      guest("b", { invitations: [{ eventId: "e1", rsvpStatus: "attending" }] }), // not due
    ]);
    const result = await runAutomaticReminders(now);
    expect(result).toEqual({ weddings: 1, queued: 1 });
    expect(queueEmail.mock.calls[0]![0]).toMatchObject({
      type: "rsvp_reminder",
      toEmail: "a@example.com",
      weddingId: "w1",
      dedupeKey: "auto:a:2027-02-01",
      meta: { by: "auto" },
    });
  });

  it("running twice does not double up (the queue refuses the same day's key)", async () => {
    weddingSvc.listRemindingWeddings.mockResolvedValue([
      { id: "w1", couple: "P & A", reminders: { enabled: true, rsvpDays: [12] } },
    ]);
    guestsSvc.listEveryGuest.mockResolvedValue([guest("a")]);
    queueEmail.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await runAutomaticReminders(now)).queued).toBe(1);
    expect((await runAutomaticReminders(now)).queued).toBe(0);
    expect(queueEmail.mock.calls[0]![0].dedupeKey).toBe(queueEmail.mock.calls[1]![0].dedupeKey);
  });

  it("does nothing when no wedding has reminders on", async () => {
    weddingSvc.listRemindingWeddings.mockResolvedValue([]);
    expect(await runAutomaticReminders(now)).toEqual({ weddings: 0, queued: 0 });
  });
});

describe("setUnsubscribed", () => {
  it("is LINK_INVALID for an unknown link", async () => {
    guestsSvc.setGuestUnsubscribed.mockResolvedValue(false);
    await expect(setUnsubscribed("nope", true)).rejects.toMatchObject({ code: "LINK_INVALID" });
  });
});
