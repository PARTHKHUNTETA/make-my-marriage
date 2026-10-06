import { jsonError, jsonOk } from "@/lib/http";
import { clearSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST /api/auth/logout. Clears the session cookie. Harmless to repeat when signed out.
export async function POST() {
  try {
    await clearSession();
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
