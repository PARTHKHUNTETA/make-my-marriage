import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, resetRateLimit, subjectKey } from "@/lib/ratelimit";
import { setSession } from "@/lib/session";
import { loginSchema } from "@/modules/members/schema";
import { logIn } from "@/modules/members/service";

export const dynamic = "force-dynamic";

const WINDOW = 15 * 60;

// POST /api/auth/login. Brute-force protection (api-design §3) has three layers: a limit per IP, a
// tight one per email from one IP (so a stranger hammering someone's email only locks themselves
// out), and a looser one per email across all IPs against guessing spread over many addresses.
// A successful login clears the person's own counter, so honest typos do not add up.
export async function POST(request: Request) {
  try {
    const ip = clientIp(request.headers);
    await consumeRateLimit("login", subjectKey("ip", ip), { limit: 30, windowSeconds: WINDOW });
    const input = loginSchema.parse(await readJsonBody(request));
    const pair = subjectKey("ip-email", `${ip}|${input.email}`);
    await consumeRateLimit("login", pair, { limit: 10, windowSeconds: WINDOW });
    await consumeRateLimit("login", subjectKey("email", input.email), {
      limit: 60,
      windowSeconds: WINDOW,
    });
    const user = await logIn(input);
    await resetRateLimit("login", pair);
    await setSession(user.id, input.remember);
    return jsonOk({ user, next: "/dashboard" });
  } catch (err) {
    return jsonError(err);
  }
}
