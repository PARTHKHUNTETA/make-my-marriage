import "server-only";
import { AppError } from "@/lib/errors";
import {
  resolveContext,
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

export async function requireVendor(): Promise<VendorContext> {
  const ctx = await resolveContext();
  if (ctx.kind !== "vendor") throw new AppError("UNAUTHENTICATED", "Sign in to continue");
  return ctx;
}
