import { z } from "zod";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { setUnsubscribed } from "@/modules/invitations/sending";

export const dynamic = "force-dynamic";

// POST /api/unsubscribe/[token]: stops (or, with { "unsubscribe": false }, restarts) reminder
// emails for one guest. Mail apps also post "List-Unsubscribe=One-Click" here (RFC 8058), which
// is not JSON, so that form of the request means "unsubscribe". Only POST changes anything, so
// a mail scanner opening the link cannot unsubscribe anyone.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await consumeRateLimit("unsubscribe", subjectKey("ip", clientIp(request.headers)), {
      limit: 30,
      windowSeconds: 60 * 60,
    });
    const { token } = await params;
    const isJson = request.headers.get("content-type")?.toLowerCase().includes("application/json");
    const unsubscribe = isJson
      ? z.object({ unsubscribe: z.boolean() }).parse(await readJsonBody(request)).unsubscribe
      : true;
    await setUnsubscribed(token, unsubscribe);
    return jsonOk({ unsubscribed: unsubscribe });
  } catch (err) {
    return jsonError(err);
  }
}
