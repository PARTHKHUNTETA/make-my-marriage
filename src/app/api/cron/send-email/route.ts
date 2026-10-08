import { isCronAuthorized } from "@/lib/cron";
import { deliverJob } from "@/lib/email";
import { AppError } from "@/lib/errors";
import { jsonError, jsonOk } from "@/lib/http";
import { drainEmailQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

// Drains the email queue. It must be called every minute or so by something outside Vercel's free
// plan: an external scheduler (cron-job.org) on Hobby, or a cron entry in vercel.json on Pro. Without
// that, a failed first send is retried only when the daily job runs. Claims due emails in small batches, so
// overlapping runs never send the same one twice; failures back off and retry (lib/queue.ts).
// Schedulers call with GET; POST is accepted for manual runs. Both need the cron secret.
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
