import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { setVendorSession } from "@/lib/session";
import { vendorLoginSchema } from "@/modules/marketplace/schema";
import { logInVendor } from "@/modules/marketplace/service";

export const dynamic = "force-dynamic";

const WINDOW = 15 * 60;

// POST /api/vendor/login. Same brute-force protection as member sign-in: a limit per IP and a
// tighter one per email.
export async function POST(request: Request) {
  try {
    await consumeRateLimit("vendor-login", subjectKey("ip", clientIp(request.headers)), {
      limit: 30,
      windowSeconds: WINDOW,
    });
    const input = vendorLoginSchema.parse(await readJsonBody(request));
    await consumeRateLimit("vendor-login", subjectKey("email", input.email), {
      limit: 10,
      windowSeconds: WINDOW,
    });
    const vendor = await logInVendor(input);
    await setVendorSession(vendor.id, input.remember);
    return jsonOk({ vendor, next: "/listing" });
  } catch (err) {
    return jsonError(err);
  }
}
