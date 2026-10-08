import "server-only";
import { createHash } from "node:crypto";
import type { Collection } from "mongodb";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

// Fixed-window counters in MongoDB with a TTL index (system-design §3): no Redis. One
// document per "<action>:<subject>"; the TTL index deletes it once its window ends.
type RateLimitDoc = { _id: string; count: number; expiresAt: Date };

// `cost` is how much one call counts for (default 1): a batch of 50 files can count as 50.
export type RateLimit = { limit: number; windowSeconds: number; cost?: number };

let ready: Promise<Collection<RateLimitDoc>> | undefined;

function collection(): Promise<Collection<RateLimitDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<RateLimitDoc>("rateLimits");
    await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    return col;
  })();
  // A failed setup must not stay cached.
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

// Subjects (IPs, emails) are hashed so the counter collection holds no personal data.
export function subjectKey(kind: string, value: string): string {
  return `${kind}:${createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 32)}`;
}

// Which address a request came from, for the per-IP limits. Only values our own platform sets are
// trusted: on Vercel its own headers (a client cannot send these), elsewhere the proxy's x-real-ip
// or the LAST x-forwarded-for entry (the one our nearest proxy added). The first entry is whatever
// the client wrote, so it is never used. With no header at all (local development) everyone shares
// the "unknown" bucket, which is why production must run behind a proxy that sets one.
export function clientIp(headers: Headers): string {
  if (process.env.VERCEL) {
    const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (vercel) return vercel;
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",");
  return forwarded?.at(-1)?.trim() || "unknown";
}

// Forgets a counter, for example after a successful login, so honest typos do not add up.
export async function resetRateLimit(action: string, subject: string): Promise<void> {
  await (await collection()).deleteOne({ _id: `${action}:${subject}` });
}

// Counts one attempt and throws RATE_LIMITED once the window's limit is exceeded. The update
// is a single atomic pipeline: it starts a new window if the stored one has already ended
// (TTL deletion lags by up to a minute), otherwise it increments.
export async function consumeRateLimit(
  action: string,
  subject: string,
  { limit, windowSeconds, cost = 1 }: RateLimit,
): Promise<void> {
  const col = await collection();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
  const doc = await col.findOneAndUpdate(
    { _id: `${action}:${subject}` },
    [
      {
        $set: {
          count: {
            $cond: [
              { $gt: ["$expiresAt", now] },
              { $add: [{ $ifNull: ["$count", 0] }, cost] },
              cost,
            ],
          },
          expiresAt: { $cond: [{ $gt: ["$expiresAt", now] }, "$expiresAt", windowEnd] },
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );
  if (!doc || doc.count > limit) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many attempts. Please wait a few minutes and try again.",
    );
  }
}
