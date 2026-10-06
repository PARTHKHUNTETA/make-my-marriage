import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { vendorVerifySchema } from "@/modules/marketplace/schema";
import { confirmVendorEmail } from "@/modules/marketplace/service";

export const dynamic = "force-dynamic";

// POST /api/vendor/verify: the emailed link opens a page with a button that posts here, so a mail
// scanner opening the link cannot use up the single-use token.
export async function POST(request: Request) {
  try {
    await consumeRateLimit("vendor-verify", subjectKey("ip", clientIp(request.headers)), {
      limit: 30,
      windowSeconds: 60 * 60,
    });
    const { token } = vendorVerifySchema.parse(await readJsonBody(request));
    await confirmVendorEmail(token);
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
