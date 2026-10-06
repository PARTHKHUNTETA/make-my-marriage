import { isCronAuthorized } from "@/lib/cron";
import { deliverJob } from "@/lib/email";
import { AppError } from "@/lib/errors";
import { jsonError, jsonOk } from "@/lib/http";
import { drainEmailQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

// Drains the email queue every minute (vercel.json). Claims due emails in small batches, so
// overlapping runs never send the same one twice; failures back off and retry (lib/queue.ts).
// Vercel Cron calls with GET; POST is accepted for manual runs. Both need the cron secret.
async function run(request: Request) {
  try {
    if (!isCronAuthorized(request)) throw new AppError("UNAUTHENTICATED", "Not authorised");
    return jsonOk(await drainEmailQueue(deliverJob));
  } catch (err) {
    return jsonError(err);
  }
}

export const GET = run;
export const POST = run;
