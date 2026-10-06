import { isCronAuthorized } from "@/lib/cron";
import { deliverJob } from "@/lib/email";
import { AppError } from "@/lib/errors";
import { jsonError, jsonOk } from "@/lib/http";
import { drainEmailQueue } from "@/lib/queue";
import { runAutomaticReminders } from "@/modules/invitations/sending";
import { purgeStalePending } from "@/modules/photos/service";

export const dynamic = "force-dynamic";

// Runs once a day (vercel.json): queues the automatic reminders that are due today for every
// wedding that turned them on, sends a first batch, and clears out stale unreviewed guest photos. The per-minute email run sends the rest.
async function run(request: Request) {
  try {
    if (!isCronAuthorized(request)) throw new AppError("UNAUTHENTICATED", "Not authorised");
    const queued = await runAutomaticReminders();
    const sent = await drainEmailQueue(deliverJob, 50);
    // Guest photos nobody reviewed in 60 days are deleted. A failure here must not stop the
    // reminders above, so it is reported rather than thrown.
    const photos = await purgeStalePending().catch(() => ({ deleted: 0, failed: true }));
    return jsonOk({ ...queued, ...sent, photos });
  } catch (err) {
    return jsonError(err);
  }
}

export const GET = run;
export const POST = run;
