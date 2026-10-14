import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Context } from "./context";

// Opt-in (`npm run test:integration`): the role matrix, end to end. Real Server Actions and the real
// database; only "who is signed in" is stubbed, so each row runs as a member holding that role.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

const current = vi.hoisted(() => ({ ctx: { kind: "anonymous" } as Context }));
vi.mock("@/lib/context", () => ({
  resolveContext: async () => current.ctx,
  resolveVendorContext: async () => (current.ctx.kind === "vendor" ? current.ctx : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

describe.skipIf(!enabled)("role × permission matrix against MongoDB", () => {
  let db: Db;
  let perms: typeof import("./permissions");
  let events: typeof import("@/modules/events/actions");
  let guests: typeof import("@/modules/guests/actions");
  let money: typeof import("@/modules/money/actions");
  let tasks: typeof import("@/modules/tasks/actions");
  let members: typeof import("@/modules/members/actions");
  let deletion: typeof import("@/modules/deletion/actions");
  let photos: typeof import("@/modules/photos/actions");
  const w = new ObjectId();
  const W = w.toHexString();
  const memberId = new ObjectId().toHexString();
  const otherMember = new ObjectId().toHexString();
  // Removed by the admin row of the matrix, so it is its own member.
  const removable = new ObjectId().toHexString();

  const as = (grants: readonly string[]) => {
    current.ctx = {
      kind: "member",
      userId: new ObjectId().toHexString(),
      weddingId: W,
      memberId,
      role: "manager",
      roleIds: ["test"],
      permissions: perms.mergeGrants([grants]),
      palette: "aubergine",
      weddingIds: [W],
    };
  };

  beforeAll(async () => {
    perms = await import("./permissions");
    events = await import("@/modules/events/actions");
    guests = await import("@/modules/guests/actions");
    money = await import("@/modules/money/actions");
    tasks = await import("@/modules/tasks/actions");
    members = await import("@/modules/members/actions");
    deletion = await import("@/modules/deletion/actions");
    photos = await import("@/modules/photos/actions");
    db = await (await import("@/lib/db")).getDb();
    // members of this wedding, so a task can be assigned to them
    await db.collection("weddingMembers").insertMany([
      {
        _id: new ObjectId(removable),
        weddingId: w,
        userId: new ObjectId(),
        role: "manager",
        roleIds: ["manager"],
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(memberId),
        weddingId: w,
        userId: new ObjectId(),
        role: "manager",
        roleIds: ["manager"],
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(otherMember),
        weddingId: w,
        userId: new ObjectId(),
        role: "manager",
        roleIds: ["manager"],
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });
  afterAll(async () => {
    if (!db) return;
    for (const c of ["events", "guests", "expenses", "tasks", "weddingMembers", "albums"])
      await db.collection(c).deleteMany({ weddingId: w });
  });

  // One representative action per permission area. Allowed means it ran; denied means FORBIDDEN.
  const cases = () =>
    ({
      "event.edit": () =>
        events.createEventAction({
          type: "sangeet",
          name: "Sangeet",
          date: "2099-02-13",
          startTime: "18:00",
        }),
      "guest.edit": () =>
        guests.createGuestAction({ name: "Meera", guestsAllowed: 2, invitedEventIds: [] }),
      "expense.edit": () =>
        money.createExpenseAction({
          title: "Florist",
          amount: "5000",
          date: "2099-01-01",
          category: "decoration",
          paidBy: "couple",
        }),
      "budget.edit": () => money.setOverallBudgetAction({ amount: "500000" }),
      "task.edit": () =>
        tasks.createTaskAction({ title: "Book band", status: "todo", priority: "high" }),
      "photo.view": () => photos.listAlbumsAction(),
      "member.invite": () => members.cancelInviteAction({ inviteId: new ObjectId().toHexString() }),
      "member.manage": () => members.removeMemberAction({ memberId: removable }),
      "wedding.delete": () => deletion.deleteWeddingAction({ confirmTitle: "not the title" }),
    }) as const;

  // What each built-in role may do among the cases above.
  const EXPECTED: Record<string, string[]> = {
    admin: [
      "event.edit",
      "guest.edit",
      "expense.edit",
      "budget.edit",
      "task.edit",
      "photo.view",
      "member.invite",
      "member.manage",
      "wedding.delete",
    ],
    manager: ["event.edit", "guest.edit", "expense.edit", "budget.edit", "task.edit", "photo.view"],
    finance: ["expense.edit", "budget.edit"],
    viewer: ["photo.view"],
  };

  for (const role of ["admin", "manager", "finance", "viewer"] as const) {
    it(`${role}: can do exactly what the matrix says`, async () => {
      as(perms.BUILT_IN_ROLES[role].grants);
      for (const [permission, run] of Object.entries(cases())) {
        const result = await run();
        const forbidden =
          !result.ok &&
          result.error.code === "FORBIDDEN" &&
          /permission/.test(result.error.message);
        expect(forbidden, `${role} → ${permission}: ${JSON.stringify(result).slice(0, 160)}`).toBe(
          !EXPECTED[role]!.includes(permission),
        );
      }
    });
  }

  it("only-my-tasks: can add a task for themselves, not for someone else", async () => {
    as(["task.view@assigned", "task.edit@assigned"]);
    const mine = await tasks.createTaskAction({ title: "Mine", status: "todo", priority: "low" });
    expect(mine).toMatchObject({ ok: true });
    const saved = await db
      .collection("tasks")
      .findOne({ _id: new ObjectId((mine as { data: { id: string } }).data.id) });
    expect(saved?.assignedMemberId?.toHexString()).toBe(memberId); // given to themselves
    const theirs = await tasks.createTaskAction({
      title: "Theirs",
      status: "todo",
      priority: "low",
      assignedMemberId: otherMember,
    });
    expect(theirs).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("only-my-tasks: someone else's task cannot be completed or deleted", async () => {
    as(perms.BUILT_IN_ROLES.manager.grants);
    const r = await tasks.createTaskAction({
      title: "Order flowers",
      status: "todo",
      priority: "low",
      assignedMemberId: otherMember,
    });
    const id = (r as { data: { id: string } }).data.id;
    as(["task.view@assigned", "task.edit@assigned"]);
    expect(await tasks.changeTaskStatusAction({ taskId: id, status: "completed" })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await tasks.deleteTaskAction({ taskId: id })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect((await db.collection("tasks").findOne({ _id: new ObjectId(id) }))?.status).toBe("todo");
  });

  it("a vendor session or a signed-out visitor gets no wedding action at all", async () => {
    for (const ctx of [
      { kind: "vendor", vendorAccountId: "v1" },
      { kind: "anonymous" },
    ] as Context[]) {
      current.ctx = ctx;
      for (const run of Object.values(cases())) {
        const result = await run();
        expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
      }
    }
  });
});
