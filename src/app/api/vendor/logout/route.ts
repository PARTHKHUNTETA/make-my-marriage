import { jsonError, jsonOk } from "@/lib/http";
import { clearVendorSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST /api/vendor/logout: ends the vendor session only; a wedding member session is untouched.
export async function POST() {
  try {
    await clearVendorSession();
    return jsonOk({});
  } catch (err) {
    return jsonError(err);
  }
}
