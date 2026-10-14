"use server";

import { setActiveWeddingId } from "@/lib/active-wedding";
import { safeAction } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/lib/authz";
import { createWeddingSchema, updateWeddingSchema } from "./schema";
import { createWedding, updateWeddingDetails } from "./service";

// First-time setup. Validates, resolves who is calling, then calls the service. Failures come
// back as typed values (see lib/action.ts), not as thrown errors.
export async function createWeddingAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireUser();
    const parsed = createWeddingSchema.parse(input);
    const created = await createWedding(ctx.userId, parsed);
    // Work in the wedding just made, even if the account has others.
    await setActiveWeddingId(created.weddingId);
    return created;
  });
}

// Settings → Wedding details. Open to Admins and Managers. The wedding is always the caller's own,
// taken from the session, never from the input.
export async function updateWeddingAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("wedding.update");
    const parsed = updateWeddingSchema.parse(input);
    await updateWeddingDetails(ctx.weddingId, parsed);
    // The sidebar, dashboard hero and settings all show these details.
    revalidatePath("/", "layout");
    return {};
  });
}
