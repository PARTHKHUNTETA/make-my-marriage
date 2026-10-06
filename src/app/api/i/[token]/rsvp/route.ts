import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { rsvpSchema } from "@/modules/guests/schema";
import { submitGuestRsvp } from "@/modules/invitations/service";

export const dynamic = "force-dynamic";

// POST /api/i/[token]/rsvp: a guest's reply for one event. Replaces any earlier reply.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await consumeRateLimit("rsvp", subjectKey("ip", clientIp(request.headers)), {
      limit: 60,
      windowSeconds: 15 * 60,
    });
    const { token } = await params;
    const input = rsvpSchema.parse(await readJsonBody(request));
    return jsonOk(await submitGuestRsvp(token, input));
  } catch (err) {
    return jsonError(err);
  }
}
