import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { vendorResetSchema } from "@/modules/marketplace/schema";
import { resetVendorPassword } from "@/modules/marketplace/service";

export const dynamic = "force-dynamic";

// POST /api/vendor/reset: sets a new password from an emailed single-use token (valid for an
// hour) and signs out every other session. It does not log the vendor in.
export async function POST(request: Request) {
  try {
    await consumeRateLimit("vendor-reset", subjectKey("ip", clientIp(request.headers)), {
      limit: 20,
      windowSeconds: 60 * 60,
    });
    const { token, password } = vendorResetSchema.parse(await readJsonBody(request));
    await resetVendorPassword(token, password);
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
