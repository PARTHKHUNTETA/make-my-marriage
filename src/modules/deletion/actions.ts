"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { getWedding } from "@/modules/wedding/service";
import { deleteWeddingSchema } from "./schema";
import { deleteWedding } from "./service";

// Admins only. The wedding is the caller's own, from the session, never from the input.
export async function deleteWeddingAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("wedding.delete");
    const { confirmTitle } = deleteWeddingSchema.parse(input);
    const wedding = await getWedding(ctx.weddingId);
    await deleteWedding(ctx.weddingId, confirmTitle);
    // A platform entry, not a wedding one: the wedding's own log is erased with the wedding.
    await recordAudit({
      actorUserId: ctx.userId,
      action: "wedding.delete",
      target: `${wedding?.title ?? "A wedding"} (${ctx.weddingId})`,
    });
    // The public site and every page that showed the wedding must stop at once.
    if (wedding) revalidatePath(`/${wedding.website.slug}`);
    revalidatePath("/", "layout");
    return {};
  });
}
