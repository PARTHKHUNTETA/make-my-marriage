import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): the dashboard's reply figures, worked out in the database,
// must equal what the old in-memory logic gave, including awkward guests. Two throwaway weddings.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("reply overview against MongoDB", () => {
  let guests: typeof import("./service");
  let schema: typeof import("./schema");
  let db: Db;
  const A = new ObjectId().toHexString();
  const B = new ObjectId().toHexString();
  const ev = [
    new ObjectId().toHexString(),
    new ObjectId().toHexString(),
    new ObjectId().toHexString(),
  ];

  const add = (w: string, name: string, eventIds: string[]) =>
    guests.createGuest(
      w,
      schema.guestInputSchema.parse({ name, guestsAllowed: 4, invitedEventIds: eventIds }),
    );
  const wait = () => new Promise((r) => setTimeout(r, 15)); // distinct reply times

  // The logic the dashboard used before: load everyone, then count in code.
  const oldWay = async (w: string) => {
    const all = await guests.listEveryGuest(w);
    return {
      attendingParties: all.filter((g) => g.invitations.some((i) => i.rsvpStatus === "attending"))
        .length,
      declinedParties: all.filter(
        (g) =>
          g.invitations.length > 0 && g.invitations.every((i) => i.rsvpStatus === "not_attending"),
      ).length,
      recent: all
        .flatMap((g) =>
          g.invitations
            .filter((i) => i.rsvpStatus !== "pending" && i.respondedAt)
            .map((i) => ({ g, i })),
        )
        .sort((a, b) => b.i.respondedAt!.getTime() - a.i.respondedAt!.getTime())
        .slice(0, 5)
        .map(({ g, i }) => `${g.id}:${i.eventId}:${i.rsvpStatus}`),
    };
  };
  const clean = async () =>
    db.collection("guests").deleteMany({ weddingId: { $in: [new ObjectId(A), new ObjectId(B)] } });

  beforeAll(async () => {
    guests = await import("./service");
    schema = await import("./schema");
    db = await (await import("@/lib/db")).getDb();
    await guests.getStats(A);
    await clean();
    const all = {
      comingAll: await add(A, "Coming to all", ev),
      mixed: await add(A, "Mixed", ev),
      declinedAll: await add(A, "Declined all", ev),
      declinedOne: await add(A, "Declined their only event", [ev[0]!]),
      waiting: await add(A, "Waiting", ev),
      partial: await add(A, "Declined one, waiting on rest", ev),
      attendOne: await add(A, "Attending only one", ev),
    };
    for (const e of ev) {
      await guests.overrideRsvp(A, all.comingAll.id, e, {
        status: "attending",
        numberAttending: 2,
      });
      await wait();
    }
    await guests.overrideRsvp(A, all.mixed.id, ev[0]!, { status: "attending", numberAttending: 1 });
    await wait();
    await guests.overrideRsvp(A, all.mixed.id, ev[1]!, { status: "not_attending" });
    await wait();
    for (const e of ev) {
      await guests.overrideRsvp(A, all.declinedAll.id, e, { status: "not_attending" });
      await wait();
    }
    await guests.overrideRsvp(A, all.declinedOne.id, ev[0]!, { status: "not_attending" });
    await wait();
    await guests.overrideRsvp(A, all.partial.id, ev[0]!, { status: "not_attending" });
    await wait();
    await guests.overrideRsvp(A, all.attendOne.id, ev[2]!, {
      status: "attending",
      numberAttending: 3,
    });
    // Another wedding's replies must never leak in.
    const other = await add(B, "Other wedding", ev);
    await guests.overrideRsvp(B, other.id, ev[0]!, { status: "attending", numberAttending: 4 });
  }, 120_000);
  afterAll(async () => {
    if (db) await clean();
  });

  it("counts parties coming and parties who declined exactly as the old logic did", async () => {
    const now = await guests.getReplyOverview(A);
    const before = await oldWay(A);
    expect(now.attendingParties).toBe(before.attendingParties);
    expect(now.declinedParties).toBe(before.declinedParties);
    // Spelled out: comingAll, mixed and attendOne are coming; declinedAll and declinedOne declined;
    // waiting and partial (declined one, waiting on the rest) are neither.
    expect(now.attendingParties).toBe(3);
    expect(now.declinedParties).toBe(2);
  });

  it("lists the latest answers, newest first, the same ones the old logic picked", async () => {
    const now = await guests.getReplyOverview(A);
    const before = await oldWay(A);
    expect(now.recent.map((r) => `${r.guestId}:${r.eventId}:${r.status}`)).toEqual(before.recent);
    expect(now.recent).toHaveLength(5);
    const times = now.recent.map((r) => r.respondedAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(now.recent[0]!.guestName).toBe("Attending only one");
    expect(now.recent[0]!.numberAttending).toBe(3);
  });

  it("never includes waiting guests or another wedding's replies, and respects the limit", async () => {
    const now = await guests.getReplyOverview(A, 2);
    expect(now.recent).toHaveLength(2);
    const names = (await guests.getReplyOverview(A, 50)).recent.map((r) => r.guestName);
    expect(names).not.toContain("Waiting");
    expect(names).not.toContain("Other wedding");
    expect(await guests.getReplyOverview(new ObjectId().toHexString())).toEqual({
      attendingParties: 0,
      declinedParties: 0,
      recent: [],
    });
  });
});
