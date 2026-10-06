import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { setSession } from "@/lib/session";
import { inviteSignupSchema, signupSchema } from "@/modules/members/schema";
import { signUp, signUpWithInvite } from "@/modules/members/service";

export const dynamic = "force-dynamic";

// POST /api/auth/signup. Two shapes, as in api-design §3:
//   - { name, email, password }: creates the account and signs it in. The wedding itself is made
//     in the first-time setup step that follows (the doc's single "creates wedding" call needs
//     the bride, groom, date and city, which sign-up does not collect).
//   - { name, password, token }: sign-up from an invitation. The email comes from the invitation,
//     and the new account joins that wedding as a Manager straight away.
export async function POST(request: Request) {
  try {
    // Malformed requests are rejected here, before they use any of the budget.
    const body = await readJsonBody(request);
    const fromInvite = typeof body === "object" && body !== null && "token" in body;
    // A sign-up from an invitation already needs a valid single-use token, so it is far harder to
    // abuse, and several relatives often share one connection at a family gathering. It gets a
    // separate, larger allowance than open sign-ups.
    await consumeRateLimit(
      fromInvite ? "signup-invite" : "signup",
      subjectKey("ip", clientIp(request.headers)),
      { limit: fromInvite ? 30 : 5, windowSeconds: 60 * 60 },
    );
    const user = fromInvite
      ? await signUpWithInvite(inviteSignupSchema.parse(body))
      : await signUp(signupSchema.parse(body));
    await setSession(user.id, true);
    return jsonOk({ user, next: fromInvite ? "/dashboard" : "/setup" }, 201);
  } catch (err) {
    return jsonError(err);
  }
}
