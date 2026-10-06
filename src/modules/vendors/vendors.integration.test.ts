import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): vendors, payment schedules and the expenses they create,
// on the real database with two throwaway weddings removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("vendors and payment schedules against MongoDB", () => {
  let vendors: typeof import("./service");
  let schema: typeof import("./schema");
  let money: typeof import("@/modules/money/service");
  let events: typeof import("@/modules/events/service");
  let eventSchema: typeof import("@/modules/events/schema");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const A = wA.toHexString();
  const B = wB.toHexString();

  const vendor = (over: Record<string, unknown> = {}) =>
    schema.vendorInputSchema.parse({
      name: "Pixel Photography",
      category: "photographer",
      eventIds: [],
      ...over,
    });
  const plan = (over: Record<string, unknown> = {}) =>
    schema.installmentInputSchema.parse({
      label: "Advance",
      amount: "50,000",
      dueDate: "2027-01-10",
      ...over,
    });
  const expenses = (w: ObjectId = wA) => db.collection("expenses").find({ weddingId: w }).toArray();
  const clean = () =>
    Promise.all(
      ["vendors", "expenses", "budgets", "events", "tasks", "guests"].map((n) =>
        db.collection(n).deleteMany({ weddingId: { $in: [wA, wB] } }),
      ),
    );

  beforeAll(async () => {
    vendors = await import("./service");
    schema = await import("./schema");
    money = await import("@/modules/money/service");
    events = await import("@/modules/events/service");
    eventSchema = await import("@/modules/events/schema");
    db = await (await import("@/lib/db")).getDb();
    await vendors.listVendors(A);
    await money.getSummary(A);
    await money.getBudgetOverview(A, null, []);
    await events.listEvents(A);
    await clean();
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("stores contact details, cost in paise, and linked events", async () => {
    const ev = await events.createEvent(
      A,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name: "Haldi",
        date: "2027-02-10",
        startTime: "10:00",
      }),
    );
    const v = await vendors.createVendor(
      A,
      vendor({
        phone: "98765 43210",
        email: "Hello@Pixel.in",
        totalCost: "1,50,000",
        eventIds: [ev.id],
      }),
    );
    expect(v).toMatchObject({
      phone: "+919876543210",
      email: "hello@pixel.in",
      totalCost: 15_000_000,
      eventIds: [ev.id],
    });
    const raw = await db.collection("vendors").findOne({ _id: new ObjectId(v.id) });
    expect(raw?.eventIds[0]).toBeInstanceOf(ObjectId);
    expect(raw).not.toHaveProperty("address");
  });

  it("one wedding never sees or changes another wedding's vendors", async () => {
    const v = await vendors.createVendor(A, vendor({ name: "Only in A" }));
    const i = await vendors.addInstallment(A, v.id, plan());
    expect(await vendors.listVendors(B)).toEqual([]);
    expect(await vendors.getVendor(B, v.id)).toBeNull();
    await expect(vendors.updateVendor(B, v.id, vendor())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(vendors.deleteVendor(B, v.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(vendors.addInstallment(B, v.id, plan())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      vendors.markInstallmentPaid(B, v.id, i.id, { paidBy: "couple" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await vendors.getVendor(A, v.id))?.installments).toHaveLength(1);
  });

  it("marking an installment paid creates one linked expense in the right category", async () => {
    await db.collection("expenses").deleteMany({ weddingId: wA });
    const v = await vendors.createVendor(
      A,
      vendor({ name: "Spice Caterers", category: "caterer" }),
    );
    const i = await vendors.addInstallment(A, v.id, plan({ label: "Advance", amount: "25,000" }));
    await vendors.markInstallmentPaid(A, v.id, i.id, {
      paidBy: "groom_family",
      paidOn: "2027-01-05",
    });

    const rows = await expenses();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Spice Caterers — Advance",
      amount: 2_500_000,
      category: "catering",
      paidBy: "groom_family",
    });
    expect(rows[0]!.vendorId.toHexString()).toBe(v.id);
    expect(rows[0]!.installmentId.toHexString()).toBe(i.id);
    expect(rows[0]!.date.toISOString()).toBe("2027-01-04T18:30:00.000Z"); // 5 Jan, midnight in India
    const saved = (await vendors.getVendor(A, v.id))!.installments[0]!;
    expect(saved).toMatchObject({ status: "paid" });
    expect(await vendors.getVendorSpend(A, v.id)).toBe(2_500_000);
  });

  it("pressing paid twice at the same moment still creates exactly one expense", async () => {
    await db.collection("expenses").deleteMany({ weddingId: wA });
    const v = await vendors.createVendor(A, vendor({ name: "Race Vendor" }));
    const i = await vendors.addInstallment(A, v.id, plan());
    const results = await Promise.allSettled([
      vendors.markInstallmentPaid(A, v.id, i.id, { paidBy: "couple" }),
      vendors.markInstallmentPaid(A, v.id, i.id, { paidBy: "couple" }),
      vendors.markInstallmentPaid(A, v.id, i.id, { paidBy: "couple" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await expenses()).toHaveLength(1);
    await expect(
      vendors.markInstallmentPaid(A, v.id, i.id, { paidBy: "couple" }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("a paid installment cannot be edited or deleted; marking it unpaid removes the expense", async () => {
    await db.collection("expenses").deleteMany({ weddingId: wA });
    const v = await vendors.createVendor(A, vendor({ name: "Locked Vendor" }));
    const i = await vendors.addInstallment(A, v.id, plan());
    await vendors.markInstallmentPaid(A, v.id, i.id, { paidBy: "couple" });
    await expect(
      vendors.updateInstallment(A, v.id, i.id, plan({ amount: "1" })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(vendors.deleteInstallment(A, v.id, i.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await vendors.getVendor(A, v.id))!.installments[0]!.amount).toBe(5_000_000);

    await vendors.markInstallmentUnpaid(A, v.id, i.id);
    expect(await expenses()).toHaveLength(0);
    const back = (await vendors.getVendor(A, v.id))!.installments[0]!;
    expect(back.status).not.toBe("paid");
    expect(back.paidOn).toBeUndefined();
    await expect(vendors.markInstallmentUnpaid(A, v.id, i.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await vendors.updateInstallment(
      A,
      v.id,
      i.id,
      plan({ label: "Changed", amount: "10,000", dueDate: "2027-03-01" }),
    );
    expect((await vendors.getVendor(A, v.id))!.installments[0]).toMatchObject({
      label: "Changed",
      amount: 1_000_000,
    });
    await vendors.deleteInstallment(A, v.id, i.id);
    expect((await vendors.getVendor(A, v.id))!.installments).toHaveLength(0);
  });

  it("if the expense cannot be saved, the installment is not left marked paid", async () => {
    await db.collection("expenses").deleteMany({ weddingId: wA });
    const v = await vendors.createVendor(A, vendor({ name: "Atomic Vendor" }));
    const i = await vendors.addInstallment(A, v.id, plan());
    // An out-of-range date makes the expense insert fail after the installment was flipped.
    await expect(
      vendors.markInstallmentPaid(A, v.id, i.id, { paidBy: "couple", paidOn: "2027-02-30" }),
    ).rejects.toBeTruthy();
    expect((await vendors.getVendor(A, v.id))!.installments[0]!.status).not.toBe("paid");
    expect(await expenses()).toHaveLength(0);
  });

  it("lists installments by due date with each vendor's balance", async () => {
    await db.collection("vendors").deleteMany({ weddingId: wA });
    await db.collection("expenses").deleteMany({ weddingId: wA });
    const a = await vendors.createVendor(A, vendor({ name: "A Vendor", totalCost: "1,00,000" }));
    const b = await vendors.createVendor(A, vendor({ name: "B Vendor" }));
    const a1 = await vendors.addInstallment(
      A,
      a.id,
      plan({ label: "Final", dueDate: "2027-03-01", amount: "40,000" }),
    );
    await vendors.addInstallment(
      A,
      a.id,
      plan({ label: "Advance", dueDate: "2027-01-01", amount: "60,000" }),
    );
    await vendors.addInstallment(
      A,
      b.id,
      plan({ label: "Booking", dueDate: "2027-02-01", amount: "5,000" }),
    );
    await vendors.markInstallmentPaid(A, a.id, a1.id, { paidBy: "couple" });

    const { rows, balances } = await vendors.getPaymentSchedule(A);
    expect(rows.map((r) => `${r.vendorName}:${r.installment.label}`)).toEqual([
      "A Vendor:Advance",
      "B Vendor:Booking",
      "A Vendor:Final",
    ]);
    expect(balances.find((x) => x.name === "A Vendor")).toMatchObject({
      totalCost: 10_000_000,
      spent: 4_000_000,
      balance: 6_000_000,
    });
    expect(balances.find((x) => x.name === "B Vendor")).toMatchObject({
      spent: 0,
      balance: undefined,
    });
    expect((await vendors.getPaymentSchedule(B)).rows).toEqual([]);
  });

  it("filters by category and event", async () => {
    await db.collection("vendors").deleteMany({ weddingId: wA });
    const ev = await events.createEvent(
      A,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name: "Mehndi",
        date: "2027-02-09",
        startTime: "10:00",
      }),
    );
    await vendors.createVendor(A, vendor({ name: "Zed", category: "dj", eventIds: [ev.id] }));
    await vendors.createVendor(A, vendor({ name: "alpha", category: "caterer" }));
    const names = async (q: Parameters<typeof vendors.listVendors>[1]) =>
      (await vendors.listVendors(A, q)).map((x) => x.vendor.name);
    expect(await names({})).toEqual(["alpha", "Zed"]);
    expect(await names({ category: "dj" })).toEqual(["Zed"]);
    expect(await names({ eventId: ev.id })).toEqual(["Zed"]);
  });

  it("deleting a vendor keeps its expenses and amounts, and removes only the link", async () => {
    await db.collection("expenses").deleteMany({ weddingId: wA });
    const v = await vendors.createVendor(A, vendor({ name: "Doomed Vendor" }));
    const i = await vendors.addInstallment(A, v.id, plan());
    await vendors.markInstallmentPaid(A, v.id, i.id, { paidBy: "couple" });
    const before = (await money.getSummary(A)).total;

    await vendors.deleteVendor(A, v.id);

    const kept = (await expenses())[0]!;
    expect(kept).toMatchObject({ amount: 5_000_000 });
    expect(kept).not.toHaveProperty("vendorId");
    expect(kept).not.toHaveProperty("installmentId");
    expect((await money.getSummary(A)).total).toBe(before);
    expect(await vendors.getVendor(A, v.id)).toBeNull();
  });

  it("deleting an event keeps its vendors and removes only the event from their lists", async () => {
    const ev = await events.createEvent(
      A,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name: "Gone",
        date: "2027-02-08",
        startTime: "10:00",
      }),
    );
    const keep = await events.createEvent(
      A,
      eventSchema.eventInputSchema.parse({
        type: "custom",
        name: "Stays",
        date: "2027-02-07",
        startTime: "10:00",
      }),
    );
    const v = await vendors.createVendor(
      A,
      vendor({ name: "Linked Vendor", eventIds: [ev.id, keep.id] }),
    );
    expect(await events.previewEventDelete(A, ev.id)).toMatchObject({ vendorCount: 1 });

    await events.deleteEvent(A, ev.id);

    expect((await vendors.getVendor(A, v.id))!.eventIds).toEqual([keep.id]);
  });

  it("expenses can be filtered by vendor", async () => {
    await db.collection("expenses").deleteMany({ weddingId: wA });
    const v = await vendors.createVendor(A, vendor({ name: "Filter Vendor" }));
    const i = await vendors.addInstallment(A, v.id, plan());
    await vendors.markInstallmentPaid(A, v.id, i.id, { paidBy: "couple" });
    const { expenseInputSchema } = await import("@/modules/money/schema");
    await money.createExpense(
      A,
      expenseInputSchema.parse({
        title: "Other",
        amount: "100",
        date: "2027-01-01",
        category: "gifts",
        paidBy: "couple",
      }),
    );
    const titles = async (vendorId?: string) =>
      (await money.listExpenses(A, { page: 1, vendorId })).items.map((e) => e.title);
    expect(await titles(v.id)).toEqual(["Filter Vendor — Advance"]);
    expect(await titles("none")).toEqual(["Other"]);
    expect(await titles()).toHaveLength(2);
  });
});
