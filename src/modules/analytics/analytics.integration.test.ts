import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): the Analytics numbers against real data, built through the
// real services, with a throwaway wedding removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("analytics against MongoDB", () => {
  let analytics: typeof import("./service");
  let events: typeof import("@/modules/events/service");
  let eventSchema: typeof import("@/modules/events/schema");
  let money: typeof import("@/modules/money/service");
  let moneySchema: typeof import("@/modules/money/schema");
  let guests: typeof import("@/modules/guests/service");
  let guestSchema: typeof import("@/modules/guests/schema");
  let tasks: typeof import("@/modules/tasks/service");
  let taskSchema: typeof import("@/modules/tasks/schema");
  let db: Db;
  const W = new ObjectId();
  const other = new ObjectId();
  const w = W.toHexString();
  const me = new ObjectId().toHexString();
  let haldi = "";
  let wedding = "";

  const chart = async (id: string, filter = {}) =>
    (await analytics.getAnalytics(w, filter, me)).charts.find((c) => c.id === id)!;
  const series = (c: { series: { name: string; values: number[] }[] }, name: string) =>
    c.series.find((s) => s.name === name)!.values;
  const clean = async () => {
    for (const c of ["events", "expenses", "budgets", "guests", "tasks", "albums", "photos"])
      await db.collection(c).deleteMany({ weddingId: { $in: [W, other] } });
    await db.collection("weddings").deleteMany({ _id: { $in: [W, other] } });
  };

  beforeAll(async () => {
    analytics = await import("./service");
    events = await import("@/modules/events/service");
    eventSchema = await import("@/modules/events/schema");
    money = await import("@/modules/money/service");
    moneySchema = await import("@/modules/money/schema");
    guests = await import("@/modules/guests/service");
    guestSchema = await import("@/modules/guests/schema");
    tasks = await import("@/modules/tasks/service");
    taskSchema = await import("@/modules/tasks/schema");
    db = await (await import("@/lib/db")).getDb();
    await events.listEvents(w);
    await money.getSummary(w);
    await guests.getStats(w);
    await tasks.listTasks(w, { view: "all" }, me);
    await analytics.getAnalytics(w, {}, me);
    await clean();
    await db.collection("weddings").insertOne({
      _id: W,
      brideName: "Asha",
      groomName: "Dev",
      title: "Asha weds Dev",
      date: new Date("2099-02-14T00:00:00+05:30"),
      city: "Pune",
      website: {
        slug: `zz-an-${w}`,
        theme: "minimal",
        isOn: false,
        showGallery: false,
        showLive: false,
      },
      galleryToken: `zza${w}`,
      uploadsOn: false,
      overallBudget: 100_000_00,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const event = (name: string, date: string) =>
      events.createEvent(
        w,
        eventSchema.eventInputSchema.parse({ type: "custom", name, date, startTime: "10:00" }),
      );
    haldi = (await event("Haldi", "2099-02-12")).id;
    wedding = (await event("Wedding", "2099-02-14")).id;

    const expense = (
      title: string,
      amount: string,
      date: string,
      category: string,
      paidBy: string,
      eventId?: string,
    ) =>
      money.createExpense(
        w,
        moneySchema.expenseInputSchema.parse({
          title,
          amount,
          date,
          category,
          paidBy,
          eventId: eventId ?? "",
        }),
      );
    await expense("Venue deposit", "50000", "2099-01-05", "venue", "bride_family", wedding);
    await expense("Caterer", "30000", "2099-01-06", "catering", "groom_family", haldi);
    await expense("Decor", "20000", "2099-01-20", "decoration", "couple", wedding);
    await money.setCategoryBudget(w, "venue", 80_000_00);

    const guest = (name: string, ids: string[]) =>
      guests.createGuest(
        w,
        guestSchema.guestInputSchema.parse({ name, guestsAllowed: 4, invitedEventIds: ids }),
      );
    const g1 = await guest("Meera", [haldi, wedding]);
    const g2 = await guest("Kabir", [haldi, wedding]);
    await guest("Rhea", [wedding]);
    await guests.overrideRsvp(w, g1.id, wedding, { status: "attending", numberAttending: 3 });
    await guests.overrideRsvp(w, g2.id, wedding, { status: "not_attending" });
    await guests.overrideRsvp(w, g1.id, haldi, { status: "attending", numberAttending: 2 });

    const t1 = await tasks.createTask(
      w,
      taskSchema.taskInputSchema.parse({
        title: "Book band",
        status: "todo",
        priority: "medium",
        eventId: wedding,
      }),
    );
    await tasks.createTask(
      w,
      taskSchema.taskInputSchema.parse({ title: "Still open", status: "todo", priority: "medium" }),
    );
    await tasks.changeTaskStatus(w, t1.id, "completed");

    const album = (
      await db.collection("albums").insertOne({
        weddingId: W,
        eventId: new ObjectId(wedding),
        name: "Wedding",
        isGeneral: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ).insertedId;
    const photo = (uploaderType: string, status: string) => ({
      _id: new ObjectId(),
      weddingId: W,
      albumId: album,
      originalKey: "k",
      claimedDisplay: false,
      claimedThumb: false,
      fileName: "a.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1,
      uploaderType,
      status,
      uploadKey: `u:${new ObjectId()}`,
      uploadedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db
      .collection("photos")
      .insertMany([
        photo("member", "approved"),
        photo("guest", "approved"),
        photo("guest", "approved"),
        photo("guest", "pending"),
      ]);
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("builds all seven charts", async () => {
    const { charts } = await analytics.getAnalytics(w, {}, me);
    expect(charts.map((c) => c.id)).toEqual([
      "spending-by-category",
      "spending-over-time",
      "contribution-by-payer",
      "rsvp-by-event",
      "headcount-by-event",
      "task-progress",
      "photos-by-event",
    ]);
    for (const c of charts) for (const s of c.series) expect(s.values.length).toBe(c.labels.length);
  });

  it("spending by category compares each budget with what was spent, in paise", async () => {
    const c = await chart("spending-by-category");
    const at = (label: string) => c.labels.indexOf(label);
    expect(series(c, "Spent")[at("Venue")]).toBe(50_000_00);
    expect(series(c, "Budget")[at("Venue")]).toBe(80_000_00);
    expect(series(c, "Spent")[at("Catering")]).toBe(30_000_00);
    expect(c.labels).not.toContain("Entertainment"); // nothing spent and no budget: left out
  });

  it("spending over time ends at the total, and contribution by payer adds up to it too", async () => {
    const line = await chart("spending-over-time");
    expect(series(line, "Spent so far").at(-1)).toBe(100_000_00);
    const payer = await chart("contribution-by-payer");
    expect(series(payer, "Paid")).toEqual([50_000_00, 30_000_00, 20_000_00]);
  });

  it("RSVP and headcount count what guests actually said", async () => {
    const rsvp = await chart("rsvp-by-event");
    const i = rsvp.labels.indexOf("Wedding");
    expect(series(rsvp, "Attending")[i]).toBe(1);
    expect(series(rsvp, "Not attending")[i]).toBe(1);
    expect(series(rsvp, "Pending")[i]).toBe(1);
    const head = await chart("headcount-by-event");
    expect(series(head, "Expected")[head.labels.indexOf("Wedding")]).toBe(3);
    expect(series(head, "Checked in").every((v) => v === 0)).toBe(true);
  });

  it("task progress counts completed tasks only", async () => {
    const c = await chart("task-progress");
    expect(series(c, "Completed").at(-1)).toBe(1);
  });

  it("photos by event counts approved photos only, members apart from guests", async () => {
    const c = await chart("photos-by-event");
    const i = c.labels.indexOf("Wedding");
    expect(series(c, "Members")[i]).toBe(1);
    expect(series(c, "Guests")[i]).toBe(2); // the waiting one is not counted
  });

  it("an event filter narrows every chart to that event and hides the whole-wedding budgets", async () => {
    const spend = await chart("spending-by-category", { eventId: haldi });
    expect(spend.labels).toEqual(["Catering"]);
    expect(spend.series.map((s) => s.name)).toEqual(["Spent"]);
    expect(series(await chart("contribution-by-payer", { eventId: haldi }), "Paid")).toEqual([
      0, 30_000_00, 0,
    ]);
    expect((await chart("rsvp-by-event", { eventId: haldi })).labels).toEqual(["Haldi"]);
    const photos = await chart("photos-by-event", { eventId: haldi });
    expect(photos.labels).toEqual(["Haldi"]); // its album exists, with nothing in it yet
    expect(photos.series.every((x) => x.values[0] === 0)).toBe(true);
    expect((await analytics.getAnalytics(w, { eventId: haldi }, me)).notes.join(" ")).toMatch(
      /Budgets/,
    );
  });

  it("a date range keeps only spending and events inside it", async () => {
    const early = await chart("spending-by-category", { from: "2099-01-01", to: "2099-01-10" });
    expect(early.labels.sort()).toEqual(["Catering", "Venue"]);
    const events12 = await chart("rsvp-by-event", { from: "2099-02-12", to: "2099-02-13" });
    expect(events12.labels).toEqual(["Haldi"]);
    expect((await chart("spending-over-time", { from: "2099-02-01" })).labels).toEqual([]);
  });

  it("another wedding's data never appears", async () => {
    const theirs = await analytics.getAnalytics(other.toHexString(), {}, me);
    for (const c of theirs.charts)
      expect(c.series.every((s) => s.values.every((v) => v === 0))).toBe(true);
  });
});
