import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { scoped } from "./scoped";

const WEDDING = new ObjectId();
const OTHER = new ObjectId();
const SOME_ID = new ObjectId();

// A stand-in collection that records what the helper sends to the driver.
function fakeCollection() {
  return {
    find: vi.fn(() => "cursor"),
    findOne: vi.fn(async () => null),
    countDocuments: vi.fn(async () => 0),
    insertOne: vi.fn(async () => ({ acknowledged: true })),
    updateOne: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({})),
    deleteOne: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({})),
    findOneAndUpdate: vi.fn(async () => null),
    findOneAndDelete: vi.fn(async () => null),
    aggregate: vi.fn(() => "agg"),
  };
}
const open = (col = fakeCollection()) =>
  ({ col, s: scoped(col as never, { weddingId: WEDDING.toHexString() }) }) as const;

describe("scoped: reads and deletes", () => {
  it("ANDs the weddingId onto every filter", async () => {
    const { col, s } = open();
    s.find({ status: "todo" });
    await s.findOne({ _id: SOME_ID });
    await s.countDocuments();
    await s.deleteOne({ _id: SOME_ID });
    await s.deleteMany({});
    const filters = [col.find, col.findOne, col.countDocuments, col.deleteOne, col.deleteMany].map(
      (fn) => (fn.mock.calls[0] as unknown[])[0],
    );
    for (const filter of filters) {
      expect(JSON.stringify(filter)).toContain('"$and"');
      expect((filter as { $and: unknown[] }).$and.at(-1)).toEqual({ weddingId: WEDDING });
    }
  });

  it("keeps the caller's own conditions", () => {
    const { col, s } = open();
    s.find({ status: "todo" });
    expect((col.find.mock.calls[0] as unknown[])[0]).toEqual({
      $and: [{ status: "todo" }, { weddingId: WEDDING }],
    });
  });

  it("cannot be steered to another wedding: a conflicting weddingId in the filter still requires this one", () => {
    const { col, s } = open();
    s.find({ weddingId: OTHER });
    // Both conditions must hold, and no document has two weddingIds, so nothing matches.
    expect((col.find.mock.calls[0] as unknown[])[0]).toEqual({
      $and: [{ weddingId: OTHER }, { weddingId: WEDDING }],
    });
  });

  it("scopes an empty filter too (there is no unscoped find-all)", () => {
    const { col, s } = open();
    s.find();
    expect((col.find.mock.calls[0] as unknown[])[0]).toEqual({
      $and: [{}, { weddingId: WEDDING }],
    });
  });

  it("passes options such as a transaction session through", async () => {
    const { col, s } = open();
    const session = { id: "s" };
    await s.findOne({}, { session } as never);
    expect((col.findOne.mock.calls[0] as unknown[])[1]).toEqual({ session });
  });
});

describe("scoped: inserts", () => {
  it("stamps the weddingId", async () => {
    const { col, s } = open();
    await s.insertOne({ title: "Book DJ" } as never);
    expect((col.insertOne.mock.calls[0] as unknown[])[0]).toEqual({
      title: "Book DJ",
      weddingId: WEDDING,
    });
  });

  it("overrides a weddingId supplied by the caller", async () => {
    const { col, s } = open();
    await s.insertOne({ title: "x", weddingId: OTHER } as never);
    expect(
      ((col.insertOne.mock.calls[0] as unknown[])[0] as { weddingId: ObjectId }).weddingId,
    ).toEqual(WEDDING);
  });
});

describe("scoped: updates", () => {
  it("scopes the filter", async () => {
    const { col, s } = open();
    await s.updateOne({ _id: SOME_ID }, { $set: { title: "New" } });
    await s.updateMany({}, { $set: { status: "done" } });
    for (const fn of [col.updateOne, col.updateMany]) {
      expect(((fn.mock.calls[0] as unknown[])[0] as { $and: unknown[] }).$and.at(-1)).toEqual({
        weddingId: WEDDING,
      });
    }
  });

  it.each([
    ["$set", { $set: { weddingId: OTHER } }],
    ["$unset", { $unset: { weddingId: "" } }],
    ["a nested path", { $set: { "x.weddingId": 1 } }],
    ["a pipeline", [{ $set: { weddingId: OTHER } }]],
  ])("refuses to rewrite weddingId via %s", async (_label, update) => {
    const { col, s } = open();
    expect(() => s.updateOne({}, update as never)).toThrow(/weddingId/);
    expect(col.updateOne).not.toHaveBeenCalled();
  });

  it("makes an upsert create the document in this wedding", async () => {
    const { col, s } = open();
    await s.updateOne({ scope: "category" }, { $set: { amount: 5 } }, { upsert: true });
    expect((col.updateOne.mock.calls[0] as unknown[])[1]).toEqual({
      $set: { amount: 5 },
      $setOnInsert: { weddingId: WEDDING },
    });
  });

  it("keeps the caller's own $setOnInsert when upserting", async () => {
    const { col, s } = open();
    await s.updateOne({}, { $set: { a: 1 }, $setOnInsert: { createdAt: 1 } }, { upsert: true });
    expect(
      ((col.updateOne.mock.calls[0] as unknown[])[1] as { $setOnInsert: object }).$setOnInsert,
    ).toEqual({
      createdAt: 1,
      weddingId: WEDDING,
    });
  });

  it("refuses to upsert with a pipeline update", () => {
    const { s } = open();
    expect(() => s.updateOne({}, [{ $set: { a: 1 } }] as never, { upsert: true })).toThrow(
      /pipeline/,
    );
  });
});

describe("scoped: aggregations", () => {
  it("starts the pipeline with a $match on the wedding", () => {
    const { col, s } = open();
    s.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
    expect((col.aggregate.mock.calls[0] as unknown[])[0]).toEqual([
      { $match: { weddingId: WEDDING } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
  });

  it.each(["$lookup", "$graphLookup", "$unionWith", "$merge", "$out"])(
    "rejects %s, which could reach other collections",
    (stage) => {
      const { col, s } = open();
      expect(() => s.aggregate([{ [stage]: {} }])).toThrow(stage);
      expect(col.aggregate).not.toHaveBeenCalled();
    },
  );
});

describe("scoped: construction", () => {
  it("refuses an invalid weddingId (a programming error, never silently unscoped)", () => {
    for (const bad of ["", "not-an-id", "123"]) {
      expect(() => scoped(fakeCollection() as never, { weddingId: bad })).toThrow(
        /invalid weddingId/,
      );
    }
  });
});

describe("scoped: atomic find-and-modify", () => {
  it("findOneAndUpdate scopes the filter and asks for the document back without metadata", async () => {
    const { col, s } = open();
    await s.findOneAndUpdate(
      { _id: SOME_ID, status: "pending" },
      { $set: { status: "done" } },
      { returnDocument: "after" },
    );
    const [filter, update, options] = col.findOneAndUpdate.mock.calls[0]! as unknown as [
      { $and: unknown[] },
      unknown,
      Record<string, unknown>,
    ];
    expect(filter.$and.at(-1)).toEqual({ weddingId: WEDDING });
    expect(update).toEqual({ $set: { status: "done" } });
    expect(options).toMatchObject({ returnDocument: "after", includeResultMetadata: false });
  });

  it("findOneAndUpdate cannot rewrite weddingId", () => {
    const { col, s } = open();
    expect(() => s.findOneAndUpdate({}, { $set: { weddingId: OTHER } })).toThrow(/weddingId/);
    expect(col.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("findOneAndUpdate makes an upsert create the document in this wedding", async () => {
    const { col, s } = open();
    await s.findOneAndUpdate({ k: 1 }, { $set: { a: 1 } }, { upsert: true });
    expect((col.findOneAndUpdate.mock.calls[0] as unknown[])[1]).toEqual({
      $set: { a: 1 },
      $setOnInsert: { weddingId: WEDDING },
    });
  });

  it("findOneAndDelete scopes the filter", async () => {
    const { col, s } = open();
    await s.findOneAndDelete({ _id: SOME_ID });
    const [filter, options] = col.findOneAndDelete.mock.calls[0]! as unknown as [
      { $and: unknown[] },
      Record<string, unknown>,
    ];
    expect(filter.$and.at(-1)).toEqual({ weddingId: WEDDING });
    expect(options).toMatchObject({ includeResultMetadata: false });
  });
});
