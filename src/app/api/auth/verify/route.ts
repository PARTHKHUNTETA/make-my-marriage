import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { verifyEmailSchema } from "@/modules/members/schema";
import { confirmEmail } from "@/modules/members/service";

export const dynamic = "force-dynamic";

// POST /api/auth/verify. The emailed link opens a page with a "Confirm" button that posts here,
// rather than confirming on a plain GET: mail scanners often open links automatically, which
// would use up the single-use token before the person clicks it.
export async function POST(request: Request) {
  try {
    await consumeRateLimit("verify", subjectKey("ip", clientIp(request.headers)), {
      limit: 30,
      windowSeconds: 60 * 60,
    });
    const { token } = verifyEmailSchema.parse(await readJsonBody(request));
    await confirmEmail(token);
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
