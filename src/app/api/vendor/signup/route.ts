import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { setVendorSession } from "@/lib/session";
import { vendorSignupSchema } from "@/modules/marketplace/schema";
import { signUpVendor } from "@/modules/marketplace/service";

export const dynamic = "force-dynamic";

// POST /api/vendor/signup: a vendor's own account, separate from wedding members. Signs them in
// and sends the verification email. Malformed requests are rejected before using any of the limit.
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    await consumeRateLimit("vendor-signup", subjectKey("ip", clientIp(request.headers)), {
      limit: 5,
      windowSeconds: 60 * 60,
    });
    const vendor = await signUpVendor(vendorSignupSchema.parse(body));
    await setVendorSession(vendor.id, true);
    return jsonOk({ vendor, next: "/listing" }, 201);
  } catch (err) {
    return jsonError(err);
  }
}
