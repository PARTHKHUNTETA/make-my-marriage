import "server-only";
import { AppError } from "@/lib/errors";
import { getStaffEmails } from "@/lib/env";
import {
  PERMISSIONS,
  can,
  platformPermissionsOf,
  type Permission,
  type PlatformPermission,
  type Scope,
} from "@/lib/permissions";
import { getPlatformRoles, getProfile } from "@/modules/members/service";
import {
  resolveContext,
  resolveVendorContext,
  type Context,
  type MemberContext,
  type UserContext,
  type VendorContext,
} from "@/lib/context";

// Whether this caller is a member who holds the permission. For showing or hiding things; the action
// behind them still checks with requirePermission.
export const hasPermission = (ctx: Context, permission: Permission): boolean =>
  ctx.kind === "member" && can(ctx.permissions, permission);

// Kept while pages move over to hasPermission (RBAC rollout): managing the team.
export const canManageMembers = (ctx: Context): boolean => hasPermission(ctx, "member.manage");

// Every Server Action begins with one of these.

// Any signed-in account, with or without a wedding (account settings, first-time setup).
export async function requireUser(): Promise<UserContext | MemberContext> {
  const ctx = await resolveContext();
  if (ctx.kind !== "user" && ctx.kind !== "member") {
    throw new AppError("UNAUTHENTICATED", "Sign in to continue");
  }
  return ctx;
}

export async function requireMember(): Promise<MemberContext> {
  const ctx = await resolveContext();
  if (ctx.kind === "user") throw new AppError("FORBIDDEN", "Set up your wedding first");
  if (ctx.kind !== "member") throw new AppError("UNAUTHENTICATED", "Sign in to continue");
  return ctx;
}

// The guard every wedding action uses: a member of the wedding who holds this permission. Returns
// the scope it is held with ("wedding", or "assigned" for "only my own"), which the action must
// pass on to the query. Deny by default: a permission nobody granted is simply not there.
export async function requirePermission(
  permission: Permission,
): Promise<MemberContext & { scope: Scope }> {
  const ctx = await requireMember();
  const scope = ctx.permissions[permission];
  if (!scope)
    throw new AppError(
      "FORBIDDEN",
      `You don't have permission to ${PERMISSIONS[permission].label.toLowerCase()}.`,
    );
  return { ...ctx, scope };
}

// Kept while actions move over to requirePermission (RBAC rollout): managing the team.
export async function requireAdmin(): Promise<MemberContext> {
  return requirePermission("member.manage");
}

// The vendor portal. Vendors have their own session; a wedding member's session never opens it.
export async function requireVendor(): Promise<VendorContext> {
  const ctx = await resolveVendorContext();
  if (!ctx) throw new AppError("UNAUTHENTICATED", "Sign in to continue");
  return ctx;
}

export type StaffContext = {
  userId: string;
  email: string;
  permissions: Set<PlatformPermission>;
};

// The Make My Marriage team: a signed-in account with a verified email and at least one platform
// role. Anyone on STAFF_EMAILS counts as a super admin, so the team can never lock itself out.
// Everyone else, including every wedding member and vendor, is refused.
export async function requireStaff(): Promise<StaffContext> {
  const ctx = await requireUser();
  const [profile, roles] = await Promise.all([
    getProfile(ctx.userId),
    getPlatformRoles(ctx.userId),
  ]);
  if (!profile) throw new AppError("UNAUTHENTICATED", "Sign in to continue");
  const bootstrap = getStaffEmails().includes(profile.email.toLowerCase()) ? ["super_admin"] : [];
  const permissions = platformPermissionsOf([...roles, ...bootstrap]);
  if (!profile.emailVerified || permissions.size === 0)
    throw new AppError("FORBIDDEN", "This area is for the Make My Marriage team");
  return { userId: ctx.userId, email: profile.email, permissions };
}

// One platform permission, e.g. approving vendor listings.
export async function requirePlatform(permission: PlatformPermission): Promise<StaffContext> {
  const staff = await requireStaff();
  if (!staff.permissions.has(permission))
    throw new AppError("FORBIDDEN", "Your staff role does not allow this.");
  return staff;
}
