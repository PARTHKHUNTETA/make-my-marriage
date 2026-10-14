"use server";

import { safeAction } from "@/lib/action";
import { requirePermission } from "@/lib/authz";
import { discoverSchema } from "./schema";
import { discoverVendors } from "./service";

// Any member may search; the daily cap is per wedding, taken from the session.
export async function discoverAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("marketplace.book");
    return discoverVendors(ctx.weddingId, discoverSchema.parse(input));
  });
}
