import "server-only";
import { AppError } from "@/lib/errors";
import { getStaffEmails } from "@/lib/env";
import { getProfile } from "@/modules/members/service";
import {
  resolveContext,
  resolveVendorContext,
  type Context,
  type MemberContext,
  type UserContext,
  type VendorContext,
} from "@/lib/context";

// Permissions are a two-row table, not a policy engine (system-design §7).
export const canManageMembers = (ctx: Context): boolean =>
  ctx.kind === "member" && ctx.role === "admin";

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

export async function requireAdmin(): Promise<MemberContext> {
  const ctx = await requireMember();
  if (!canManageMembers(ctx)) throw new AppError("FORBIDDEN", "Only an admin can do this");
  return ctx;
}

// The vendor portal. Vendors have their own session; a wedding member's session never opens it.
export async function requireVendor(): Promise<VendorContext> {
  const ctx = await resolveVendorContext();
  if (!ctx) throw new AppError("UNAUTHENTICATED", "Sign in to continue");
  return ctx;
}

// The Make My Marriage team: a signed-in account whose verified email is on the staff list
// (STAFF_EMAILS). Anyone else, including every wedding member and vendor, is refused.
export async function requireStaff(): Promise<{ userId: string; email: string }> {
  const ctx = await requireUser();
  const profile = await getProfile(ctx.userId);
  if (!profile) throw new AppError("UNAUTHENTICATED", "Sign in to continue");
  if (!profile.emailVerified || !getStaffEmails().includes(profile.email.toLowerCase()))
    throw new AppError("FORBIDDEN", "This area is for the Make My Marriage team");
  return { userId: ctx.userId, email: profile.email };
}
