import "server-only";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/authz";
import type { MemberContext } from "@/lib/context";
import type { Permission, Scope } from "@/lib/permissions";

// For pages: the same rule as requirePermission, but a member without the permission gets the
// ordinary "not found" page rather than an error, so an area they cannot use simply is not there.
// (The member layout has already sent signed-out visitors to sign-in.)
export async function requirePagePermission(
  permission: Permission,
): Promise<MemberContext & { scope: Scope }> {
  const ctx = await requireMember();
  const scope = ctx.permissions[permission];
  if (!scope) notFound();
  return { ...ctx, scope };
}
