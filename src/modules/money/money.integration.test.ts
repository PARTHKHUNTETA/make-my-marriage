import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): expenses and budgets on the real database, with two
// throwaway weddings removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("expenses and budgets against MongoDB", () => {
  let money: typeof import("./service");
  let schema: typeof import("./schema");
  let events: typeof import("@/modules/events/service");
  let eventSchema: typeof import("@/modules/events/schema");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();

  const expense = (over: Record<string, unknown> = {}) =>
    schema.expenseInputSchema.parse({
      title: "Photographer advance",
      amount: "50,000",
      date: "2027-01-10",
      category: "photography",
      paidBy: "couple",
      ...over,
    });
  const clean = () =>
    Promise.all(
      ["expenses", "budgets", "events", "tasks", "guests"].map((n) =>
        db.collection(n).deleteMany({ weddingId: { $in: [wA, wB] } }),
      ),
    );

  beforeAll(async () => {
    money = await import("./service");
    schema = await import("./schema");
    events = await import("@/modules/events/service");
    eventSchema = await import("@/modules/events/schema");
    db = await (await import("@/lib/db")).getDb();
    await money.getSummary(A); // creates the expense indexes
    await money.getBudgetOverview(A, null, []); // and the budget index
    await events.listEvents(A);
    await clean();
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("stores whole paise and returns them unchanged", async () => {
    const e = await money.createExpense(A, expense({ amount: "499.50" }));
    expect(e.amount).toBe(49_950);
    const raw = await db.collection("expenses").findOne({ _id: new ObjectId(e.id) });
    expect(raw).toMatchObject({ amount: 49_950, category: "photography", paidBy: "couple" });
    expect(raw).not.toHaveProperty("splits");
    expect(raw).not.toHaveProperty("eventId");
  });

  it("one wedding never sees or changes another wedding's expenses", async () => {
    const e = await money.createExpense(A, expense({ title: "Only in A" }));
    expect((await money.listExpenses(B, { page: 1 })).total).toBe(0);
    expect(await money.getExpense(B, e.id)).toBeNull();
    await expect(money.updateExpense(B, e.id, expense())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(money.deleteExpense(B, e.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await money.getSummary(B)).total).toBe(0);
    expect((await money.getExpense(A, e.id))?.title).toBe("Only in A");
  });

  it("a shared expense keeps its splits, and switching to one payer drops them", async () => {
    const e = await money.createExpense(
      A,
      expense({ paidBy: "shared", amount: "1000.01", shareBride: "50", shareGroom: "50" }),
    );
    expect((await money.getExpense(A, e.id))?.splits).toEqual([
      { payer: "bride_family", percentage: 50 },
      { payer: "groom_family", percentage: 50 },
    ]);
    await money.updateExpense(A, e.id, expense({ paidBy: "groom_family" }));
    const raw = await db.collection("expenses").findOne({ _id: new ObjectId(e.id) });
    expect(raw).toMatchObject({ paidBy: "groom_family" });
    expect(raw).not.toHaveProperty("splits");
  });

  it("summaries add up exactly, with shared expenses divided to the paisa", async () => {
    await db.collection("expenses").deleteMany({ weddingId: wA });
    await money.createExpense(
      A,
      expense({ category: "venue", amount: "3000", paidBy: "bride_family" }),
    );
    await money.createExpense(
      A,
      expense({
        category: "catering",
        amount: "1000.01",
        paidBy: "shared",
        shareBride: "50",
        shareGroom: "50",
      }),
    );
    await money.createExpense(
      A,
      expense({ category: "catering", amount: "500", paidBy: "couple" }),
    );
    const s = await money.getSummary(A);
    expect(s.total).toBe(450_001);
    expect(s.byCategory).toEqual({ venue: 300_000, catering: 150_001 });
    expect(s.byPayer).toEqual({ bride_family: 350_001, groom_family: 50_000, couple: 50_000 });
    expect(Object.values(s.byPayer).reduce((a, b) => a + b, 0)).toBe(s.total);
  });

  it("filters by category, event and payer, newest first, with paging", async () => {
    await db.collection("expenses").deleteMany({ weddingId: wA });
    const ev = await events.createEvent(
      A,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name: "Haldi",
        date: "2027-02-10",
        startTime: "10:00",
      }),
    );
    await money.createExpense(A, expense({ title: "old", date: "2027-01-01", category: "venue" }));
    await money.createExpense(
      A,
      expense({ title: "new", date: "2027-03-01", category: "venue", eventId: ev.id }),
    );
    await money.createExpense(
      A,
      expense({ title: "mid", date: "2027-02-01", category: "gifts", paidBy: "groom_family" }),
    );
    const titles = async (q: Partial<import("./schema").ExpenseQuery>) =>
      (await money.listExpenses(A, { page: 1, ...q })).items.map((e) => e.title);
    expect(await titles({})).toEqual(["new", "mid", "old"]);
    expect(await titles({ category: "venue" })).toEqual(["new", "old"]);
    expect(await titles({ eventId: ev.id })).toEqual(["new"]);
    expect(await titles({ eventId: "none" })).toEqual(["mid", "old"]);
    expect(await titles({ paidBy: "groom_family" })).toEqual(["mid"]);
    expect(await titles({ page: 2 })).toEqual([]);
  });

  it("budgets: one line per category and event, updated in place, removed when blank", async () => {
    const ev = await events.createEvent(
      A,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name: "Sangeet",
        date: "2027-02-11",
        startTime: "19:00",
      }),
    );
    await Promise.all([
      money.setCategoryBudget(A, "venue", 100_000),
      money.setCategoryBudget(A, "venue", 200_000),
      money.setCategoryBudget(A, "venue", 300_000),
    ]);
    await money.setEventBudget(A, ev.id, 50_000);
    expect(
      await db
        .collection("budgets")
        .countDocuments({ weddingId: wA, scope: "category", category: "venue" }),
    ).toBe(1);

    const overview = await money.getBudgetOverview(A, 1_000_000, [{ id: ev.id, name: "Sangeet" }]);
    expect(overview.overall).toMatchObject({ budget: 1_000_000, spent: 15_000_000, over: true });
    const venue = overview.categories.find((c) => c.key === "venue")!;
    expect([100_000, 200_000, 300_000]).toContain(venue.budget);
    expect(venue.spent).toBe(10_000_000); // two expenses of ₹50,000
    expect(overview.events[0]).toMatchObject({
      label: "Sangeet",
      budget: 50_000,
      spent: 0,
      over: false,
    });

    await money.setCategoryBudget(A, "venue", null);
    expect(
      await db.collection("budgets").countDocuments({ weddingId: wA, category: "venue" }),
    ).toBe(0);
    expect(
      (await money.getBudgetOverview(B, null, [])).categories.every((c) => c.budget === null),
    ).toBe(true);
  });

  it("an over-budget line is flagged, and the same line in another wedding is untouched", async () => {
    await money.setCategoryBudget(A, "gifts", 10_000); // ₹100 against ₹50,000 spent
    await money.setCategoryBudget(B, "gifts", 99_999_999);
    const gifts = (await money.getBudgetOverview(A, null, [])).categories.find(
      (c) => c.key === "gifts",
    )!;
    expect(gifts).toMatchObject({ budget: 10_000, spent: 5_000_000, over: true });
    const other = (await money.getBudgetOverview(B, null, [])).categories.find(
      (c) => c.key === "gifts",
    )!;
    expect(other).toMatchObject({ budget: 99_999_999, spent: 0, over: false });
  });

  it("deleting an event keeps its expenses and amounts, unlinks them, and removes its budget", async () => {
    const ev = await events.createEvent(
      A,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name: "Doomed",
        date: "2027-02-12",
        startTime: "10:00",
      }),
    );
    const e = await money.createExpense(
      A,
      expense({ title: "Linked", amount: "700", eventId: ev.id }),
    );
    await money.setEventBudget(A, ev.id, 80_000);
    const before = (await money.getSummary(A)).total;
    expect(await events.previewEventDelete(A, ev.id)).toMatchObject({ expenseCount: 1 });

    await events.deleteEvent(A, ev.id);

    const kept = await db.collection("expenses").findOne({ _id: new ObjectId(e.id) });
    expect(kept).toMatchObject({ amount: 70_000, title: "Linked" });
    expect(kept).not.toHaveProperty("eventId");
    expect((await money.getSummary(A)).total).toBe(before); // totals never change silently
    expect(
      await db
        .collection("budgets")
        .countDocuments({ weddingId: wA, scope: "event", eventId: new ObjectId(ev.id) }),
    ).toBe(0);
  });
});
