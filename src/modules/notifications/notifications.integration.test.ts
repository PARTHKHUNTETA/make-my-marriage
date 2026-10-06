import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): the notification centre on the real database, with two
// throwaway weddings removed afterwards.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);
const DAY = 86_400_000;

describe.skipIf(!enabled)("notifications against MongoDB", () => {
  let svc: typeof import("./service");
  let alerts: typeof import("./alerts");
  let db: Db;
  const wA = new ObjectId();
  const wB = new ObjectId();
  const [admin, mgr, quiet, other] = [
    new ObjectId(),
    new ObjectId(),
    new ObjectId(),
    new ObjectId(),
  ];
  const vendorAccount = new ObjectId();
  const A = wA.toHexString();
  const me = (id: ObjectId) => ({ type: "member" as const, id: id.toHexString() });
  const msgs = async (id: ObjectId) => (await svc.getPanel(me(id))).items.map((i) => i.message);
  const membership = (_id: ObjectId, weddingId: ObjectId, role: string, extra = {}) => ({
    _id,
    weddingId,
    userId: new ObjectId(),
    role,
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  });
  const clean = async () => {
    const ids = [wA, wB];
    for (const c of ["weddingMembers", "tasks", "vendors"])
      await db.collection(c).deleteMany({ weddingId: { $in: ids } });
    await db.collection("notifications").deleteMany({
      $or: [
        { weddingId: { $in: ids } },
        { recipientId: { $in: [admin, mgr, quiet, other, vendorAccount] } },
      ],
    });
  };

  beforeAll(async () => {
    svc = await import("./service");
    alerts = await import("./alerts");
    db = await (await import("@/lib/db")).getDb();
    await svc.getPanel(me(admin)); // creates the indexes
    await clean();
    await db
      .collection("weddingMembers")
      .insertMany([
        membership(admin, wA, "admin"),
        membership(mgr, wA, "manager"),
        membership(quiet, wA, "manager", { mutedNotificationTypes: ["rsvp"] }),
        membership(other, wB, "admin"),
      ]);
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("tells every member of the wedding, and nobody in another wedding", async () => {
    await svc.notifyMembers(A, { type: "booking", message: "All hands" });
    for (const m of [admin, mgr, quiet]) expect(await msgs(m)).toContain("All hands");
    expect(await msgs(other)).not.toContain("All hands");
  });

  it("skips anyone who muted that type, but not other types", async () => {
    await svc.notifyMembers(A, { type: "rsvp", message: "Asha replied" });
    expect(await msgs(admin)).toContain("Asha replied");
    expect(await msgs(quiet)).not.toContain("Asha replied");
    await svc.notifyMembers(A, { type: "booking", message: "Quote in" });
    expect(await msgs(quiet)).toContain("Quote in");
  });

  it("can aim at admins only, one member, or everyone but the person who acted", async () => {
    await svc.notifyMembers(A, {
      type: "member_change",
      message: "Admins only",
      audience: "admins",
    });
    expect(await msgs(admin)).toContain("Admins only");
    expect(await msgs(mgr)).not.toContain("Admins only");
    await svc.notifyMembers(A, {
      type: "task_assigned",
      message: "Just for you",
      audience: { memberId: mgr.toHexString() },
    });
    expect(await msgs(mgr)).toContain("Just for you");
    expect(await msgs(admin)).not.toContain("Just for you");
    await svc.notifyMembers(A, {
      type: "booking",
      message: "Not me",
      exceptMemberId: admin.toHexString(),
    });
    expect(await msgs(admin)).not.toContain("Not me");
    expect(await msgs(mgr)).toContain("Not me");
  });

  it("a repeated key is stored once per person", async () => {
    for (let i = 0; i < 3; i++)
      await svc.notifyMembers(A, {
        type: "budget_alert",
        message: "90% of food",
        dedupeKey: "budget:food:90",
      });
    expect((await msgs(admin)).filter((m) => m === "90% of food")).toHaveLength(1);
    expect((await msgs(mgr)).filter((m) => m === "90% of food")).toHaveLength(1);
  });

  it("lists newest first, counts unread, and marks one or all read for that person only", async () => {
    await svc.notifyMembers(A, { type: "booking", message: "First" });
    await svc.notifyMembers(A, { type: "booking", message: "Second" });
    const panel = await svc.getPanel(me(admin));
    expect(panel.items[0]!.message).toBe("Second");
    expect(panel.unread).toBe(panel.items.filter((i) => !i.read).length);
    const target = panel.items[0]!;
    // Someone else cannot mark it read.
    await svc.readOne(me(mgr), target.id);
    expect((await svc.getPanel(me(admin))).items[0]!.read).toBe(false);
    await svc.readOne(me(admin), target.id);
    expect((await svc.getPanel(me(admin))).items[0]!.read).toBe(true);
    await svc.readAll(me(mgr));
    expect((await svc.getPanel(me(mgr))).unread).toBe(0);
    expect((await svc.getPanel(me(admin))).unread).toBeGreaterThan(0);
  });

  it("a member's id can never read a vendor's notifications, or the other way round", async () => {
    await svc.notifyVendor(vendorAccount.toHexString(), { type: "review", message: "New review" });
    expect(
      (await svc.getPanel({ type: "vendor", id: vendorAccount.toHexString() })).items.map(
        (i) => i.message,
      ),
    ).toEqual(["New review"]);
    expect((await svc.getPanel({ type: "member", id: vendorAccount.toHexString() })).items).toEqual(
      [],
    );
  });

  it("never throws, even for a wedding that does not exist or a bad id", async () => {
    await expect(
      svc.notifyMembers(new ObjectId().toHexString(), { type: "rsvp", message: "x" }),
    ).resolves.toBeUndefined();
    await expect(
      svc.notifyMembers("not-an-id", { type: "rsvp", message: "x" }),
    ).resolves.toBeUndefined();
    await expect(
      svc.notifyVendor("not-an-id", { type: "review", message: "x" }),
    ).resolves.toBeUndefined();
  });

  it("daily alerts: due and overdue tasks tell the assignee once; finished, unassigned and far-off ones are left", async () => {
    const now = new Date();
    const task = (title: string, dueInDays: number | null, extra = {}) => ({
      _id: new ObjectId(),
      weddingId: wA,
      title,
      status: "todo",
      priority: "medium",
      assignedMemberId: mgr,
      ...(dueInDays === null ? {} : { dueDate: new Date(now.getTime() + dueInDays * DAY) }),
      createdAt: now,
      updatedAt: now,
      ...extra,
    });
    await db
      .collection("tasks")
      .insertMany([
        task("Book the band", 1),
        task("Pay the florist", -3),
        task("Next month", 30),
        task("Already done", 1, { status: "completed" }),
        task("Nobody's", 1, { assignedMemberId: undefined }),
      ]);
    const first = await alerts.runDailyAlerts(now, [A]);
    expect(first.tasks).toBe(2);
    const mine = await msgs(mgr);
    expect(mine.some((m) => m.includes("Book the band") && /tomorrow|today/.test(m))).toBe(true);
    expect(mine).toContain("Overdue: Pay the florist");
    expect(
      mine.some(
        (m) => m.includes("Next month") || m.includes("Already done") || m.includes("Nobody"),
      ),
    ).toBe(false);
    expect((await msgs(admin)).some((m) => m.includes("Book the band"))).toBe(false);
    await alerts.runDailyAlerts(now, [A]);
    expect((await msgs(mgr)).filter((m) => m.includes("Book the band"))).toHaveLength(1);
  });

  it("daily alerts: installments due within 3 days or overdue tell every member, once, and paid ones are left", async () => {
    const now = new Date();
    const inst = (label: string, days: number, status = "upcoming") => ({
      _id: new ObjectId(),
      label,
      amount: 5_000_000,
      dueDate: new Date(now.getTime() + days * DAY),
      status,
    });
    await db.collection("vendors").insertOne({
      _id: new ObjectId(),
      weddingId: wA,
      name: "Royal Caterers",
      category: "caterer",
      installments: [
        inst("Advance", 2),
        inst("Balance", -1),
        inst("Far", 40),
        inst("Paid", 1, "paid"),
      ],
      createdAt: now,
      updatedAt: now,
    });
    const run = await alerts.runDailyAlerts(now, [A]);
    expect(run.payments).toBe(2);
    for (const m of [admin, mgr, quiet]) {
      const all = await msgs(m);
      expect(
        all.some(
          (t) => t.includes("Royal Caterers") && t.includes("Advance") && t.includes("₹50,000"),
        ),
      ).toBe(true);
      expect(all.some((t) => t.startsWith("Overdue payment") && t.includes("Balance"))).toBe(true);
      expect(all.some((t) => t.includes("(Far)") || t.includes("(Paid)"))).toBe(false);
    }
    await alerts.runDailyAlerts(now, [A]);
    expect((await msgs(admin)).filter((t) => t.includes("(Advance)"))).toHaveLength(1);
  });
});
