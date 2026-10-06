import { ObjectId, type Collection } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { EmailJobDoc } from "./queue";

// Opt-in: runs against the database in .env.local (`npm run test:integration`).
// Uses only its own jobs (type "zz_test"), addressed by id, and deletes them afterwards. It never
// drains the whole queue, so it cannot touch a real email.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("email queue against MongoDB", () => {
  let queue: typeof import("./queue");
  let col: Collection<EmailJobDoc>;
  const created: ObjectId[] = [];

  const make = async (extra: { dedupeKey?: string } = {}) => {
    const id = await queue.enqueueEmail({
      type: "zz_test",
      toEmail: "zz-test@example.com",
      payload: { url: "https://x.test/SECRET" },
      ...extra,
    });
    if (id) created.push(new ObjectId(id));
    return id!;
  };
  const get = (id: string) => col.findOne({ _id: new ObjectId(id) });

  beforeAll(async () => {
    queue = await import("./queue");
    const { getDb } = await import("./db");
    col = (await getDb()).collection<EmailJobDoc>("emailQueue");
  });
  afterAll(async () => {
    if (col) await col.deleteMany({ $or: [{ _id: { $in: created } }, { type: "zz_test" }] });
  });

  it("only one of two simultaneous workers sends a job", async () => {
    const id = await make();
    const deliver = vi.fn().mockResolvedValue(undefined);
    await Promise.all([
      queue.sendEmailNow(id, deliver),
      queue.sendEmailNow(id, deliver),
      queue.sendEmailNow(id, deliver),
    ]);
    expect(deliver).toHaveBeenCalledTimes(1);
    const doc = await get(id);
    expect(doc).toMatchObject({ status: "sent", attempts: 1 });
    expect(doc?.sentAt).toBeInstanceOf(Date);
  });

  it("clears the one-time link once the email is sent", async () => {
    const id = await make();
    await queue.sendEmailNow(id, async () => {});
    expect((await get(id))?.payload).toEqual({});
  });

  it("a sent job is never sent again", async () => {
    const id = await make();
    const deliver = vi.fn().mockResolvedValue(undefined);
    await queue.sendEmailNow(id, deliver);
    await queue.sendEmailNow(id, deliver);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("a failed attempt backs off, and the job is not claimable until then", async () => {
    const id = await make();
    await queue.sendEmailNow(id, async () => {
      throw new Error("provider busy");
    });
    const doc = await get(id);
    expect(doc).toMatchObject({ status: "pending", attempts: 1 });
    expect(doc!.sendAfter.getTime()).toBeGreaterThan(Date.now() + 30_000);
    expect(doc?.lastError).toContain("provider busy");

    const deliver = vi.fn();
    await queue.sendEmailNow(id, deliver); // too early
    expect(deliver).not.toHaveBeenCalled();

    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { sendAfter: new Date(Date.now() - 1000) } },
    );
    await queue.sendEmailNow(id, async () => {}); // due now
    expect(await get(id)).toMatchObject({ status: "sent", attempts: 2 });
  });

  it("a permanent failure is marked failed straight away", async () => {
    const id = await make();
    await queue.sendEmailNow(id, async () => {
      throw Object.assign(new Error("bad address"), { retryable: false });
    });
    expect(await get(id)).toMatchObject({ status: "failed", attempts: 1 });
  });

  it("a job abandoned mid-send by a crashed worker is picked up again", async () => {
    const id = await make();
    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "sending", updatedAt: new Date(Date.now() - 10 * 60_000) } },
    );
    const deliver = vi.fn().mockResolvedValue(undefined);
    await queue.sendEmailNow(id, deliver);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("a job that is still being sent by a live worker is left alone", async () => {
    const id = await make();
    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "sending", updatedAt: new Date() } },
    );
    const deliver = vi.fn();
    await queue.sendEmailNow(id, deliver);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("the same dedupeKey cannot be queued twice", async () => {
    const key = `zz-${Date.now()}`;
    const first = await make({ dedupeKey: key });
    const second = await queue.enqueueEmail({
      type: "zz_test",
      toEmail: "zz-test@example.com",
      payload: {},
      dedupeKey: key,
    });
    expect(first).toBeTruthy();
    expect(second).toBeNull();
  });

  it("jobs without a dedupeKey never collide with each other", async () => {
    const [a, b] = [await make(), await make()];
    expect(a).not.toBe(b);
  });
});
