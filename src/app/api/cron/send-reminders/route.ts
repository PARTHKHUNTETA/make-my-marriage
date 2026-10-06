import { isCronAuthorized } from "@/lib/cron";
import { deliverJob } from "@/lib/email";
import { AppError } from "@/lib/errors";
import { jsonError, jsonOk } from "@/lib/http";
import { drainEmailQueue } from "@/lib/queue";
import { runAutomaticReminders } from "@/modules/invitations/sending";

export const dynamic = "force-dynamic";

// Runs once a day (vercel.json): queues the automatic reminders that are due today for every
// wedding that turned them on, then sends a first batch. The per-minute email run sends the rest.
async function run(request: Request) {
  try {
    if (!isCronAuthorized(request)) throw new AppError("UNAUTHENTICATED", "Not authorised");
    const queued = await runAutomaticReminders();
    const sent = await drainEmailQueue(deliverJob, 50);
    return jsonOk({ ...queued, ...sent });
  } catch (err) {
    return jsonError(err);
  }
}

export const GET = run;
export const POST = run;
