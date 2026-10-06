import "server-only";
import { createHash } from "node:crypto";
import type { Collection } from "mongodb";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

// Fixed-window counters in MongoDB with a TTL index (system-design §3): no Redis. One
// document per "<action>:<subject>"; the TTL index deletes it once its window ends.
type RateLimitDoc = { _id: string; count: number; expiresAt: Date };

export type RateLimit = { limit: number; windowSeconds: number };

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

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
  );
}

// Counts one attempt and throws RATE_LIMITED once the window's limit is exceeded. The update
// is a single atomic pipeline: it starts a new window if the stored one has already ended
// (TTL deletion lags by up to a minute), otherwise it increments.
export async function consumeRateLimit(
  action: string,
  subject: string,
  { limit, windowSeconds }: RateLimit,
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
            $cond: [{ $gt: ["$expiresAt", now] }, { $add: [{ $ifNull: ["$count", 0] }, 1] }, 1],
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
