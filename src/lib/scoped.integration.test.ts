import { ObjectId, type Collection } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in: runs against the database in .env.local (a throwaway collection, dropped afterwards).
//   npm run test:integration
// It proves, on a real MongoDB, that scoped() keeps one wedding's data away from another's.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("scoped() against MongoDB", () => {
  type Doc = { _id: ObjectId; weddingId: ObjectId; title: string; status: string };
  const A = new ObjectId();
  const B = new ObjectId();
  let col: Collection<Doc>;
  let scopedFor: (id: ObjectId) => ReturnType<typeof import("./scoped").scoped<Doc>>;
  let aId: ObjectId;
  let bId: ObjectId;

  beforeAll(async () => {
    const { getDb } = await import("./db");
    const { scoped } = await import("./scoped");
    col = (await getDb()).collection<Doc>(`zz_scoped_test_${Date.now()}`);
    scopedFor = (id) => scoped(col, { weddingId: id.toHexString() });
    aId = (await scopedFor(A).insertOne({ _id: new ObjectId(), title: "A1", status: "todo" }))
      .insertedId;
    await scopedFor(A).insertOne({ _id: new ObjectId(), title: "A2", status: "done" });
    bId = (await scopedFor(B).insertOne({ _id: new ObjectId(), title: "B1", status: "todo" }))
      .insertedId;
  });

  afterAll(async () => {
    if (col) await col.drop().catch(() => {});
  });

  it("each wedding sees only its own documents", async () => {
    expect((await scopedFor(A).find().toArray()).map((d) => d.title).sort()).toEqual(["A1", "A2"]);
    expect((await scopedFor(B).find().toArray()).map((d) => d.title)).toEqual(["B1"]);
    expect(await scopedFor(A).countDocuments()).toBe(2);
  });

  it("cannot fetch another wedding's document by its _id", async () => {
    expect(await scopedFor(A).findOne({ _id: bId })).toBeNull();
    expect(await scopedFor(B).findOne({ _id: aId })).toBeNull();
    expect((await scopedFor(B).findOne({ _id: bId }))?.title).toBe("B1");
  });

  it("cannot be steered to another wedding with a weddingId in the filter", async () => {
    expect(await scopedFor(A).find({ weddingId: B }).toArray()).toEqual([]);
  });

  it("cannot update or delete another wedding's document", async () => {
    expect(
      (await scopedFor(A).updateOne({ _id: bId }, { $set: { title: "hacked" } })).matchedCount,
    ).toBe(0);
    expect((await scopedFor(A).deleteOne({ _id: bId })).deletedCount).toBe(0);
    expect((await scopedFor(A).deleteMany({})).deletedCount).toBe(2);
    expect((await col.findOne({ _id: bId }))?.title).toBe("B1"); // untouched
  });

  it("aggregations only see the wedding's own documents", async () => {
    await scopedFor(A).insertOne({ _id: new ObjectId(), title: "A3", status: "todo" });
    const rows = await scopedFor(A)
      .aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }])
      .toArray();
    expect(rows).toEqual([{ _id: "todo", n: 1 }]);
  });

  it("an upsert creates the document in the right wedding", async () => {
    await scopedFor(B).updateOne(
      { title: "Budget" },
      { $set: { status: "new" } },
      { upsert: true },
    );
    const doc = await col.findOne({ title: "Budget" });
    expect(doc?.weddingId).toEqual(B);
  });
});
