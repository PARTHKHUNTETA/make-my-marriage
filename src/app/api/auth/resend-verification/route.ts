import { requireUser } from "@/lib/authz";
import { jsonError, jsonOk } from "@/lib/http";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { resendVerification } from "@/modules/members/service";

export const dynamic = "force-dynamic";

// POST /api/auth/resend-verification. For the signed-in person; limited so it cannot be used to
// flood an inbox. Sending again invalidates the previous link.
export async function POST() {
  try {
    const ctx = await requireUser();
    await consumeRateLimit("resend-verification", subjectKey("user", ctx.userId), {
      limit: 3,
      windowSeconds: 60 * 60,
    });
    await resendVerification(ctx.userId);
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
