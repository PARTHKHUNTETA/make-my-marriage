import { MongoServerError, ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailJobDoc } from "./queue";

const col = vi.hoisted(() => ({
  createIndex: vi.fn(),
  insertOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDb: async () => ({ collection: () => col }) }));

async function load() {
  vi.resetModules();
  return import("./queue");
}

const job = (extra: Partial<EmailJobDoc> = {}): EmailJobDoc => ({
  _id: new ObjectId(),
  type: "verify",
  toEmail: "priya@example.com",
  payload: { url: "https://app.test/verify-email/SECRET" },
  status: "sending",
  attempts: 1,
  sendAfter: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...extra,
});

beforeEach(() => {
  for (const fn of Object.values(col)) fn.mockReset();
  col.createIndex.mockResolvedValue("ok");
  col.insertOne.mockResolvedValue({});
  col.updateOne.mockResolvedValue({});
});

const lastUpdate = () =>
  col.updateOne.mock.calls.at(-1)! as [
    unknown,
    { $set: Record<string, unknown> & { sendAfter: Date; lastError: string }; $unset?: object },
  ];

describe("enqueueEmail", () => {
  it("stores a pending, unattempted job due now", async () => {
    const { enqueueEmail } = await load();
    const id = await enqueueEmail({
      type: "reset",
      toEmail: "a@b.co",
      payload: { url: "https://x.test" },
    });
    const doc = col.insertOne.mock.calls[0]![0] as EmailJobDoc;
    expect(id).toBe(doc._id.toHexString());
    expect(doc).toMatchObject({ type: "reset", toEmail: "a@b.co", status: "pending", attempts: 0 });
    expect(doc.sendAfter.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("leaves out weddingId and dedupeKey when they are not given (account emails)", async () => {
    const { enqueueEmail } = await load();
    await enqueueEmail({ type: "reset", toEmail: "a@b.co", payload: {} });
    const doc = col.insertOne.mock.calls[0]![0] as EmailJobDoc;
    expect("weddingId" in doc).toBe(false);
    expect("dedupeKey" in doc).toBe(false);
  });

  it("stores weddingId and dedupeKey when given", async () => {
    const { enqueueEmail } = await load();
    const wedding = new ObjectId();
    await enqueueEmail({
      type: "x",
      toEmail: "a@b.co",
      payload: {},
      weddingId: wedding.toHexString(),
      dedupeKey: "g1:e1:2026-02-14",
    });
    expect(col.insertOne.mock.calls[0]![0]).toMatchObject({
      weddingId: wedding,
      dedupeKey: "g1:e1:2026-02-14",
    });
  });

  it("returns null for a duplicate dedupeKey instead of throwing", async () => {
    const { enqueueEmail } = await load();
    col.insertOne.mockRejectedValue(new MongoServerError({ code: 11000, message: "E11000" }));
    expect(
      await enqueueEmail({ type: "x", toEmail: "a@b.co", payload: {}, dedupeKey: "k" }),
    ).toBeNull();
  });

  it("lets other errors through", async () => {
    const { enqueueEmail } = await load();
    col.insertOne.mockRejectedValue(new Error("network"));
    await expect(enqueueEmail({ type: "x", toEmail: "a@b.co", payload: {} })).rejects.toThrow(
      "network",
    );
  });

  it("creates the claim index and a sparse unique dedupe index once", async () => {
    const { enqueueEmail } = await load();
    await enqueueEmail({ type: "x", toEmail: "a@b.co", payload: {} });
    await enqueueEmail({ type: "x", toEmail: "a@b.co", payload: {} });
    expect(col.createIndex).toHaveBeenCalledTimes(2);
    expect(col.createIndex).toHaveBeenCalledWith({ status: 1, sendAfter: 1 });
    expect(col.createIndex).toHaveBeenCalledWith({ dedupeKey: 1 }, { unique: true, sparse: true });
  });
});

describe("drainEmailQueue", () => {
  it("sends each claimed job, clears the one-time link and records the send", async () => {
    const { drainEmailQueue } = await load();
    const claimed = job();
    col.findOneAndUpdate.mockResolvedValueOnce(claimed).mockResolvedValueOnce(null);
    const deliver = vi.fn().mockResolvedValue(undefined);

    expect(await drainEmailQueue(deliver)).toEqual({ sent: 1, retried: 0, failed: 0 });
    expect(deliver).toHaveBeenCalledWith(claimed);
    const [filter, update] = lastUpdate();
    expect(filter).toEqual({ _id: claimed._id });
    expect(update.$set).toMatchObject({ status: "sent", payload: {} });
    expect(update.$set.sentAt).toBeInstanceOf(Date);
  });

  it("claims atomically: pending and due, or stuck in 'sending' too long, oldest first", async () => {
    const { drainEmailQueue } = await load();
    col.findOneAndUpdate.mockResolvedValue(null);
    await drainEmailQueue(vi.fn());
    const [filter, update, options] = col.findOneAndUpdate.mock.calls[0]!;
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0]).toMatchObject({ status: "pending" });
    expect(filter.$or[1]).toMatchObject({ status: "sending" });
    expect(update).toMatchObject({ $set: { status: "sending" }, $inc: { attempts: 1 } });
    expect(options).toMatchObject({ sort: { sendAfter: 1 }, returnDocument: "after" });
  });

  it("stops at the batch limit", async () => {
    const { drainEmailQueue } = await load();
    col.findOneAndUpdate.mockImplementation(async () => job());
    const deliver = vi.fn().mockResolvedValue(undefined);
    expect((await drainEmailQueue(deliver, 3)).sent).toBe(3);
    expect(deliver).toHaveBeenCalledTimes(3);
  });

  it.each([
    [1, 1],
    [2, 5],
    [3, 15],
    [4, 60],
  ])("after attempt %i a retryable failure waits %i minute(s)", async (attempts, minutes) => {
    const { drainEmailQueue } = await load();
    col.findOneAndUpdate.mockResolvedValueOnce(job({ attempts })).mockResolvedValueOnce(null);
    const before = Date.now();
    expect(await drainEmailQueue(vi.fn().mockRejectedValue(new Error("busy")))).toEqual({
      sent: 0,
      retried: 1,
      failed: 0,
    });
    const { $set } = lastUpdate()[1];
    expect($set.status).toBe("pending");
    expect($set.sendAfter.getTime() - before).toBeGreaterThanOrEqual(minutes * 60_000 - 50);
    expect($set.sendAfter.getTime() - before).toBeLessThan(minutes * 60_000 + 2000);
  });

  it("gives up after the maximum number of attempts", async () => {
    const { drainEmailQueue, MAX_ATTEMPTS } = await load();
    col.findOneAndUpdate
      .mockResolvedValueOnce(job({ attempts: MAX_ATTEMPTS }))
      .mockResolvedValueOnce(null);
    expect(await drainEmailQueue(vi.fn().mockRejectedValue(new Error("still down")))).toEqual({
      sent: 0,
      retried: 0,
      failed: 1,
    });
    expect(lastUpdate()[1].$set.status).toBe("failed");
  });

  it("fails a permanent error straight away, without further attempts", async () => {
    const { drainEmailQueue } = await load();
    col.findOneAndUpdate.mockResolvedValueOnce(job({ attempts: 1 })).mockResolvedValueOnce(null);
    const permanent = Object.assign(new Error("rejected (HTTP 422)"), {
      name: "EmailSendError",
      retryable: false,
    });
    expect(await drainEmailQueue(vi.fn().mockRejectedValue(permanent))).toEqual({
      sent: 0,
      retried: 0,
      failed: 1,
    });
    expect(lastUpdate()[1].$set).toMatchObject({
      status: "failed",
      lastError: "EmailSendError: rejected (HTTP 422)",
    });
  });

  it("records a short error that cannot carry a link", async () => {
    const { drainEmailQueue } = await load();
    col.findOneAndUpdate.mockResolvedValueOnce(job()).mockResolvedValueOnce(null);
    await drainEmailQueue(vi.fn().mockRejectedValue(new Error("x".repeat(500))));
    expect(lastUpdate()[1].$set.lastError.length).toBeLessThanOrEqual(200);
  });

  it("keeps going after one job fails", async () => {
    const { drainEmailQueue } = await load();
    col.findOneAndUpdate
      .mockResolvedValueOnce(job())
      .mockResolvedValueOnce(job())
      .mockResolvedValueOnce(null);
    const deliver = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    expect(await drainEmailQueue(deliver)).toEqual({ sent: 1, retried: 1, failed: 0 });
  });
});

describe("sendEmailNow", () => {
  it("claims that one job and sends it", async () => {
    const { sendEmailNow } = await load();
    const id = new ObjectId();
    col.findOneAndUpdate.mockResolvedValue(job({ _id: id }));
    const deliver = vi.fn().mockResolvedValue(undefined);
    await sendEmailNow(id.toHexString(), deliver);
    expect(col.findOneAndUpdate.mock.calls[0]![0]).toMatchObject({ _id: id });
    expect(deliver).toHaveBeenCalledOnce();
  });

  it("does nothing if another worker already took it", async () => {
    const { sendEmailNow } = await load();
    col.findOneAndUpdate.mockResolvedValue(null);
    const deliver = vi.fn();
    await sendEmailNow(new ObjectId().toHexString(), deliver);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("ignores an invalid id", async () => {
    const { sendEmailNow } = await load();
    await sendEmailNow("nope", vi.fn());
    expect(col.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
