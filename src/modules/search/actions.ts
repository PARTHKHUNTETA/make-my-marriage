"use server";

import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { searchSchema } from "./schema";
import { searchWedding } from "./service";

// Server Action behind the search box. Any member may search; the wedding always comes from the
// signed-in session, so nobody can search another wedding. Limited per person so a stuck script
// cannot hammer the database.
export async function searchAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await consumeRateLimit("search", subjectKey("member", ctx.memberId), {
      limit: 600,
      windowSeconds: 15 * 60,
    });
    const { q } = searchSchema.parse(input);
    return searchWedding(ctx.weddingId, ctx.memberId, q);
  });
}
