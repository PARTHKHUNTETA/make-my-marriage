import { requireVendor } from "@/lib/authz";
import { jsonError, jsonOk } from "@/lib/http";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { resendVendorVerification } from "@/modules/marketplace/service";

export const dynamic = "force-dynamic";

// POST /api/vendor/resend-verification: for the signed-in vendor, limited so it cannot flood an inbox.
export async function POST() {
  try {
    const ctx = await requireVendor();
    await consumeRateLimit("vendor-resend", subjectKey("vendor", ctx.vendorAccountId), {
      limit: 3,
      windowSeconds: 60 * 60,
    });
    await resendVendorVerification(ctx.vendorAccountId);
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
