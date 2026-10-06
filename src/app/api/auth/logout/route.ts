import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clearSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST /api/auth/logout. Clears the session cookie. Harmless to repeat when signed out.
export async function POST(request: Request) {
  try {
    // JSON only, like every other mutating route: a page on another site cannot send that without
    // our permission, so it cannot sign someone out by submitting a form.
    await readJsonBody(request);
    await clearSession();
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
