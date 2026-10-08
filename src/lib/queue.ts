import "server-only";
import { MongoServerError, ObjectId, type Collection, type Filter } from "mongodb";
import { getDb } from "@/lib/db";

// The email queue (system-design §9, db-design §10): one MongoDB document per email. Workers
// claim a row atomically (pending -> sending), so overlapping runs can never send the same
// email twice, and failures back off and retry on their own.

export type EmailStatus = "pending" | "sending" | "sent" | "failed";

export type EmailJobDoc = {
  _id: ObjectId;
  weddingId?: ObjectId; // absent for account emails
  type: string;
  toEmail: string;
  payload: Record<string, string>;
  // Non-sensitive facts kept after sending (who it was for, why), so a log can be shown without
  // the payload, which is wiped once the email is out.
  meta?: Record<string, string>;
  status: EmailStatus;
  attempts: number;
  dedupeKey?: string; // unique: a re-run can never enqueue the same email twice
  sendAfter: Date;
  sentAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewEmailJob = {
  type: string;
  toEmail: string;
  payload: Record<string, string>;
  meta?: Record<string, string>;
  weddingId?: string;
  dedupeKey?: string;
};

export type DeliverFn = (job: EmailJobDoc) => Promise<void>;

export const MAX_ATTEMPTS = 5;
// Wait before the next attempt, indexed by how many have been made (1 minute, then 5, 15, 60).
// A retry only happens when the queue is next drained (every minute by the scheduler described in
// api/cron/send-email, otherwise by the daily job), so these are the earliest times, not guarantees.
export const BACKOFF_MINUTES = [1, 5, 15, 60];
// A row stuck in "sending" this long belonged to a worker that died; it becomes claimable again.
export const STALE_SENDING_MS = 5 * 60_000;

let ready: Promise<Collection<EmailJobDoc>> | undefined;

function jobs(): Promise<Collection<EmailJobDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<EmailJobDoc>("emailQueue");
    await col.createIndex({ status: 1, sendAfter: 1 });
    await col.createIndex({ dedupeKey: 1 }, { unique: true, sparse: true });
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

// Returns the new job's id, or null if an email with the same dedupeKey is already queued.
export async function enqueueEmail(job: NewEmailJob): Promise<string | null> {
  const now = new Date();
  const doc: EmailJobDoc = {
    _id: new ObjectId(),
    ...(job.weddingId ? { weddingId: new ObjectId(job.weddingId) } : {}),
    type: job.type,
    toEmail: job.toEmail,
    payload: job.payload,
    ...(job.meta ? { meta: job.meta } : {}),
    status: "pending",
    attempts: 0,
    ...(job.dedupeKey ? { dedupeKey: job.dedupeKey } : {}),
    sendAfter: now,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await (await jobs()).insertOne(doc);
    return doc._id.toHexString();
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) return null;
    throw err;
  }
}

function claimable(now: Date): Filter<EmailJobDoc> {
  return {
    $or: [
      { status: "pending", sendAfter: { $lte: now } },
      { status: "sending", updatedAt: { $lte: new Date(now.getTime() - STALE_SENDING_MS) } },
    ],
  };
}

async function claim(filter: Filter<EmailJobDoc>, now: Date): Promise<EmailJobDoc | null> {
  return (await jobs()).findOneAndUpdate(
    filter,
    { $set: { status: "sending", updatedAt: now }, $inc: { attempts: 1 } },
    { sort: { sendAfter: 1 }, returnDocument: "after" },
  );
}

// One attempt for a claimed job, then record the outcome. `retryable` comes from the sender.
async function attempt(job: EmailJobDoc, deliver: DeliverFn): Promise<"sent" | "retry" | "failed"> {
  const col = await jobs();
  try {
    await deliver(job);
    // The payload held the one-time link; once sent there is no reason to keep it.
    await col.updateOne(
      { _id: job._id },
      {
        $set: { status: "sent", sentAt: new Date(), updatedAt: new Date(), payload: {} },
        $unset: { lastError: "" },
      },
    );
    return "sent";
  } catch (err) {
    const retryable = (err as { retryable?: boolean }).retryable !== false;
    const lastError =
      err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 200) : "unknown";
    if (!retryable || job.attempts >= MAX_ATTEMPTS) {
      await col.updateOne(
        { _id: job._id },
        { $set: { status: "failed", lastError, updatedAt: new Date() } },
      );
      return "failed";
    }
    const wait = BACKOFF_MINUTES[Math.min(job.attempts, BACKOFF_MINUTES.length) - 1] ?? 60;
    await col.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "pending",
          lastError,
          sendAfter: new Date(Date.now() + wait * 60_000),
          updatedAt: new Date(),
        },
      },
    );
    return "retry";
  }
}

// Sends one specific job now (used right after enqueueing). A no-op if another worker got it.
export async function sendEmailNow(id: string, deliver: DeliverFn): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const job = await claim({ _id: new ObjectId(id), ...claimable(new Date()) }, new Date());
  if (job) await attempt(job, deliver);
}

// Cron entry point: claim and send due jobs, a bounded batch per run.
export async function drainEmailQueue(
  deliver: DeliverFn,
  limit = 25,
): Promise<{ sent: number; retried: number; failed: number }> {
  const result = { sent: 0, retried: 0, failed: 0 };
  for (let i = 0; i < limit; i++) {
    const job = await claim(claimable(new Date()), new Date());
    if (!job) break;
    const outcome = await attempt(job, deliver);
    if (outcome === "sent") result.sent++;
    else if (outcome === "retry") result.retried++;
    else result.failed++;
  }
  return result;
}

export type EmailLogRow = {
  id: string;
  type: string;
  toEmail: string;
  status: EmailStatus;
  meta: Record<string, string>;
  createdAt: Date;
  sentAt?: Date;
};

// The most recent emails of the given types for one wedding, newest first.
export async function listEmailLog(
  weddingId: string,
  types: string[],
  limit = 100,
): Promise<EmailLogRow[]> {
  if (!ObjectId.isValid(weddingId)) return [];
  const rows = await (
    await jobs()
  )
    .find({ weddingId: new ObjectId(weddingId), type: { $in: types } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return rows.map((r) => ({
    id: r._id.toHexString(),
    type: r.type,
    toEmail: r.toEmail,
    status: r.status,
    meta: r.meta ?? {},
    createdAt: r.createdAt,
    sentAt: r.sentAt,
  }));
}

// How long a finished email's record is kept. The log of who was emailed is useful for a while, and
// the privacy policy promises it does not stay for ever.
export const KEEP_EMAIL_RECORDS_DAYS = 30;

// Deletes records of emails that were sent, or that gave up after their last attempt, more than
// `days` ago. Emails still waiting to go are never touched. Returns how many were removed.
export async function purgeFinishedEmails(
  now: Date = new Date(),
  days: number = KEEP_EMAIL_RECORDS_DAYS,
): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const result = await (
    await jobs()
  ).deleteMany({ status: { $in: ["sent", "failed"] }, updatedAt: { $lt: cutoff } });
  return result.deletedCount;
}
