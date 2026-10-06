import { jsonError, jsonOk } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { AppError } from "@/lib/errors";
import { getInvitation } from "@/modules/invitations/service";

export const dynamic = "force-dynamic";

// GET /api/i/[token]: the invitation as JSON, for the RSVP form. The token is the credential and
// is never echoed back.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await consumeRateLimit("invite-view", subjectKey("ip", clientIp(request.headers)), {
      limit: 120,
      windowSeconds: 15 * 60,
    });
    const { token } = await params;
    const view = await getInvitation(token);
    if (!view) throw new AppError("LINK_INVALID", "This link is not valid any more.");
    return jsonOk(view);
  } catch (err) {
    return jsonError(err);
  }
}
