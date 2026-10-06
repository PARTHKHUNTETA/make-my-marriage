import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { setSession } from "@/lib/session";
import { loginSchema } from "@/modules/members/schema";
import { logIn } from "@/modules/members/service";

export const dynamic = "force-dynamic";

const WINDOW = 15 * 60;

// POST /api/auth/login. Brute-force protection is a limit per IP and a tighter one per email
// (api-design §3). Counters are not reset on success.
export async function POST(request: Request) {
  try {
    await consumeRateLimit("login", subjectKey("ip", clientIp(request.headers)), {
      limit: 30,
      windowSeconds: WINDOW,
    });
    const input = loginSchema.parse(await readJsonBody(request));
    await consumeRateLimit("login", subjectKey("email", input.email), {
      limit: 10,
      windowSeconds: WINDOW,
    });
    const user = await logIn(input);
    await setSession(user.id, input.remember);
    return jsonOk({ user, next: "/dashboard" });
  } catch (err) {
    return jsonError(err);
  }
}
