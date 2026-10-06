import { after } from "next/server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { resetRequestSchema } from "@/modules/members/schema";
import { requestPasswordReset } from "@/modules/members/service";

export const dynamic = "force-dynamic";

const HOUR = 60 * 60;

// POST /api/auth/reset-request. Always answers the same way, whether or not the address has an
// account, so it cannot be used to find out who is registered. The lookup and the email happen
// after the response is sent, so a known address does not even take longer to answer.
export async function POST(request: Request) {
  try {
    await consumeRateLimit("reset-request", subjectKey("ip", clientIp(request.headers)), {
      limit: 20,
      windowSeconds: HOUR,
    });
    const { email } = resetRequestSchema.parse(await readJsonBody(request));
    await consumeRateLimit("reset-request", subjectKey("email", email), {
      limit: 5,
      windowSeconds: HOUR,
    });
    after(async () => {
      try {
        await requestPasswordReset(email);
      } catch (err) {
        console.error("password reset request failed", err instanceof Error ? err.name : "unknown");
      }
    });
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
