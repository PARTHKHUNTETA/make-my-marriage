import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): invitation and reminder emails against the real database
// and the real email queue, with a throwaway wedding. Sending itself is switched off, so no email
// can leave: only the queue rows are checked.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);
vi.mock("@/lib/queue", async (original) => ({
  ...(await original<typeof import("@/lib/queue")>()),
  drainEmailQueue: vi.fn().mockResolvedValue({ sent: 0, retried: 0, failed: 0 }),
}));

describe.skipIf(!enabled)("guest emails and reminders against MongoDB", () => {
  let sending: typeof import("./sending");
  let guests: typeof import("@/modules/guests/service");
  let events: typeof import("@/modules/events/service");
  let guestSchema: typeof import("@/modules/guests/schema");
  let eventSchema: typeof import("@/modules/events/schema");
  let db: Db;
  const wedding = new ObjectId();
  const W = wedding.toHexString();
  // 1 Feb 2027, mid-morning in India.
  const now = new Date("2027-02-01T10:00:00+05:30");
  let soon: string; // 12 days after `now`
  let tomorrow: string;

  const ev = (name: string, date: string) =>
    eventSchema.eventInputSchema.parse({ type: "custom", name, date, startTime: "19:00" });
  const guest = (name: string, eventIds: string[], over: Record<string, unknown> = {}) =>
    guestSchema.guestInputSchema.parse({
      name,
      guestsAllowed: 2,
      invitedEventIds: eventIds,
      email: `${name.toLowerCase().replace(/\W+/g, "-")}@example.com`,
      ...over,
    });
  const mails = (type?: string) =>
    db
      .collection("emailQueue")
      .find({ weddingId: wedding, ...(type ? { type } : {}) })
      .toArray();
  const clean = async () => {
    for (const name of ["guests", "events", "emailQueue"])
      await db.collection(name).deleteMany({ weddingId: wedding });
    await db.collection("weddings").deleteMany({ _id: wedding });
  };

  beforeAll(async () => {
    sending = await import("./sending");
    guests = await import("@/modules/guests/service");
    events = await import("@/modules/events/service");
    guestSchema = await import("@/modules/guests/schema");
    eventSchema = await import("@/modules/events/schema");
    db = await (await import("@/lib/db")).getDb();
    await events.listEvents(W);
    await guests.listGuests(W, { page: 1 });
    await sending.getEmailLog(W); // creates the queue indexes
    await clean();
    await db.collection("weddings").insertOne({
      _id: wedding,
      brideName: "Priya",
      groomName: "Aarav",
      title: "Priya weds Aarav",
      date: new Date("2027-02-14T00:00:00+05:30"),
      city: "Jaipur",
      website: {
        slug: `zz-rem-${wedding}`,
        theme: "minimal",
        isOn: false,
        showGallery: false,
        showLive: false,
      },
      galleryToken: `zz${W}`,
      uploadsOn: false,
      reminders: { enabled: true, rsvpDays: [12] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    soon = (await events.createEvent(W, ev("Sangeet", "2027-02-13"))).id;
    tomorrow = (await events.createEvent(W, ev("Haldi", "2027-02-02"))).id;
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("emails invitations once a day per guest, records it, and skips guests with no email", async () => {
    const withEmail = await guests.createGuest(W, guest("Has Email", [soon, tomorrow]));
    await guests.createGuest(W, guest("No Email", [soon], { email: "" }));

    const first = await sending.sendInvitationEmails(W, { all: true }, now);
    expect(first).toMatchObject({ queued: 1, noEmail: 1, alreadyToday: 0 });
    const again = await sending.sendInvitationEmails(W, { all: true }, now);
    expect(again).toMatchObject({ queued: 0, alreadyToday: 1 });
    const nextDay = await sending.sendInvitationEmails(
      W,
      { all: true },
      new Date("2027-02-02T10:00:00+05:30"),
    );
    expect(nextDay.queued).toBe(1);

    const rows = await mails("invitation");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      toEmail: "has-email@example.com",
      status: "pending",
      meta: { guestId: withEmail.id },
    });
    expect((await guests.getGuest(W, withEmail.id))?.inviteEmailedAt).toBeInstanceOf(Date);
    await db.collection("emailQueue").deleteMany({ weddingId: wedding });
  });

  it("the daily run emails exactly who is due, and a second run adds nothing", async () => {
    await db.collection("guests").deleteMany({ weddingId: wedding });
    const pending = await guests.createGuest(W, guest("Pending Pat", [soon]));
    const replied = await guests.createGuest(W, guest("Replied Ria", [soon]));
    const coming = await guests.createGuest(W, guest("Coming Cam", [tomorrow]));
    const quiet = await guests.createGuest(W, guest("Unsub Uma", [soon]));
    await guests.submitRsvp(replied.token, soon, { status: "attending", numberAttending: 1 });
    await guests.submitRsvp(coming.token, tomorrow, { status: "attending", numberAttending: 2 });
    await guests.setGuestUnsubscribed(quiet.token, true);

    const first = await sending.runAutomaticReminders(now);
    expect(first.queued).toBe(2);
    const rows = await db
      .collection("emailQueue")
      .find({ weddingId: wedding })
      .sort({ toEmail: 1 })
      .toArray();
    expect(rows.map((r) => [r.toEmail, r.type, r.meta.by])).toEqual([
      ["coming-cam@example.com", "event_reminder", "auto"],
      ["pending-pat@example.com", "rsvp_reminder", "auto"],
    ]);
    expect(rows[1]!.dedupeKey).toBe(`auto:${pending.id}:2027-02-01`);
    expect(rows[1]!.payload.unsubscribeUrl).toMatch(/\/unsubscribe\//);

    expect((await sending.runAutomaticReminders(now)).queued).toBe(0); // same day: nothing new
    expect(await mails()).toHaveLength(2);
    expect(
      (await sending.runAutomaticReminders(new Date("2027-02-02T10:00:00+05:30"))).queued,
    ).toBe(0); // no longer due
  });

  it("does nothing for a wedding that has reminders off", async () => {
    await db
      .collection("weddings")
      .updateOne({ _id: wedding }, { $set: { "reminders.enabled": false } });
    await db.collection("emailQueue").deleteMany({ weddingId: wedding });
    await sending.runAutomaticReminders(now);
    expect(await mails()).toHaveLength(0);
    await db
      .collection("weddings")
      .updateOne({ _id: wedding }, { $set: { "reminders.enabled": true } });
  });

  it("a manual reminder skips unsubscribed guests and leaves one log entry per email", async () => {
    await db.collection("emailQueue").deleteMany({ weddingId: wedding });
    const result = await sending.sendRsvpReminderEmails(W, { nonResponders: true }, now);
    expect(result).toMatchObject({ queued: 1, unsubscribed: 1 }); // Pending Pat; Unsub Uma left out
    expect(
      (await sending.sendRsvpReminderEmails(W, { nonResponders: true }, now)).alreadyToday,
    ).toBe(1);

    const log = await sending.getEmailLog(W);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      kind: "rsvp_reminder",
      guestName: "Pending Pat",
      automatic: false,
      status: "pending",
    });
  });

  it("unsubscribing and undoing it works from the link alone", async () => {
    const g = await guests.createGuest(W, guest("Link Lee", [soon]));
    expect(await sending.getUnsubscribeState(g.token)).toMatchObject({
      unsubscribed: false,
      couple: "Priya & Aarav",
    });
    await sending.setUnsubscribed(g.token, true);
    expect((await sending.getUnsubscribeState(g.token))?.unsubscribed).toBe(true);
    await sending.setUnsubscribed(g.token, false);
    expect((await guests.getGuest(W, g.id))?.remindersUnsubscribed).toBe(false);
    await expect(sending.setUnsubscribed("nonexistent-token-123456", true)).rejects.toMatchObject({
      code: "LINK_INVALID",
    });
    expect(await sending.getUnsubscribeState("nonexistent-token-123456")).toBeNull();
  });
});
