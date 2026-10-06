import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getCronEnv } from "@/lib/env";

// Cron routes must prove they are called by the scheduler (api-design §14). Vercel Cron sends
// "Authorization: Bearer <CRON_SECRET>" when that variable is set on the project. The check
// compares digests in constant time and treats a missing or too-short secret as "not authorised"
// rather than as an error, so a misconfigured deploy fails closed.
export function isCronAuthorized(request: Request): boolean {
  let secret: string;
  try {
    secret = getCronEnv().CRON_SECRET;
  } catch {
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(presented), digest(secret));
}
