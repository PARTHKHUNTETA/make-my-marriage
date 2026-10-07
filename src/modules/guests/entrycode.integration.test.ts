import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): a member can read the entry code of a coming party, and only
// of a coming party in their own wedding. Two throwaway weddings.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("entry codes for members against MongoDB", () => {
  let guests: typeof import("./service");
  let schema: typeof import("./schema");
  let db: Db;
  const A = new ObjectId().toHexString();
  const B = new ObjectId().toHexString();
  const [e1, e2] = [new ObjectId().toHexString(), new ObjectId().toHexString()];
  const clean = async () =>
    db.collection("guests").deleteMany({ weddingId: { $in: [new ObjectId(A), new ObjectId(B)] } });

  beforeAll(async () => {
    guests = await import("./service");
    schema = await import("./schema");
    db = await (await import("@/lib/db")).getDb();
    await guests.getStats(A);
    await clean();
  });
  afterAll(async () => {
    if (db) await clean();
  });

  it("gives the same code the guest sees on their own page, only for events they are coming to", async () => {
    const g = await guests.createGuest(
      A,
      schema.guestInputSchema.parse({ name: "Meera", guestsAllowed: 3, invitedEventIds: [e1, e2] }),
    );
    await guests.overrideRsvp(A, g.id, e1, { status: "attending", numberAttending: 2 });
    await guests.overrideRsvp(A, g.id, e2, { status: "not_attending" });
    const code = await guests.getEntryTokenForMember(A, g.id, e1);
    expect(code).toBeTruthy();
    expect(code).toBe(await guests.getEntryTokenForGuest(g.token, e1)); // identical to the guest's own
    expect(await guests.getEntryTokenForMember(A, g.id, e2)).toBeNull(); // not coming
    expect(await guests.getEntryTokenForMember(A, g.id, new ObjectId().toHexString())).toBeNull(); // not invited
  });

  it("gives nothing before the party has replied", async () => {
    const g = await guests.createGuest(
      A,
      schema.guestInputSchema.parse({ name: "Waiting", guestsAllowed: 2, invitedEventIds: [e1] }),
    );
    expect(await guests.getEntryTokenForMember(A, g.id, e1)).toBeNull();
  });

  it("never reaches across weddings", async () => {
    const mine = await guests.createGuest(
      A,
      schema.guestInputSchema.parse({ name: "Mine", guestsAllowed: 2, invitedEventIds: [e1] }),
    );
    await guests.overrideRsvp(A, mine.id, e1, { status: "attending", numberAttending: 1 });
    expect(await guests.getEntryTokenForMember(A, mine.id, e1)).toBeTruthy();
    expect(await guests.getEntryTokenForMember(B, mine.id, e1)).toBeNull();
    expect(await guests.getEntryTokenForMember(A, "not-an-id", e1)).toBeNull();
  });
});
