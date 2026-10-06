import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { resetPasswordSchema } from "@/modules/members/schema";
import { resetPassword } from "@/modules/members/service";

export const dynamic = "force-dynamic";

// POST /api/auth/reset. Sets a new password from an emailed token. The token is single-use and
// expires after an hour; a successful reset also signs out every other session. It does not log
// the person in: they sign in with the new password.
export async function POST(request: Request) {
  try {
    await consumeRateLimit("reset", subjectKey("ip", clientIp(request.headers)), {
      limit: 20,
      windowSeconds: 60 * 60,
    });
    const { token, password } = resetPasswordSchema.parse(await readJsonBody(request));
    await resetPassword(token, password);
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
