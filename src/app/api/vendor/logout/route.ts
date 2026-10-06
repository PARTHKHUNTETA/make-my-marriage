import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clearVendorSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST /api/vendor/logout: ends the vendor session only; a wedding member session is untouched.
export async function POST(request: Request) {
  try {
    // JSON only, like every other mutating route: a page on another site cannot send that without
    // our permission, so it cannot sign someone out by submitting a form.
    await readJsonBody(request);
    await clearVendorSession();
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
