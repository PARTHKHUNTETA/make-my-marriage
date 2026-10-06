import { after } from "next/server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { vendorResetRequestSchema } from "@/modules/marketplace/schema";
import { requestVendorPasswordReset } from "@/modules/marketplace/service";

export const dynamic = "force-dynamic";

const HOUR = 60 * 60;

// POST /api/vendor/reset-request: always answers the same way, so it cannot reveal which
// businesses have an account. The lookup and the email happen after the response is sent.
export async function POST(request: Request) {
  try {
    await consumeRateLimit("vendor-reset-request", subjectKey("ip", clientIp(request.headers)), {
      limit: 20,
      windowSeconds: HOUR,
    });
    const { email } = vendorResetRequestSchema.parse(await readJsonBody(request));
    await consumeRateLimit("vendor-reset-request", subjectKey("email", email), {
      limit: 5,
      windowSeconds: HOUR,
    });
    after(async () => {
      try {
        await requestVendorPasswordReset(email);
      } catch (err) {
        console.error(
          "vendor password reset request failed",
          err instanceof Error ? err.name : "unknown",
        );
      }
    });
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
