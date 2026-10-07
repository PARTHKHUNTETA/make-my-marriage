import "server-only";
import { cache } from "react";
import type { PaletteId } from "@/lib/palettes";
import { readSession, readVendorSession } from "@/lib/session";
import { getVendorAuthState } from "@/modules/marketplace/service";
import { getAuthState, getMembership } from "@/modules/members/service";

// Who is calling, resolved once per server entry point before any data is touched
// (system-design §7). weddingId always comes from the session or token, never from input.
//
// `user` is a signed-in account that does not belong to a wedding yet: it exists between
// sign-up and the first-time wedding setup. Once the account has a wedding, the same
// session resolves to `member`.
export type Context =
  | {
      kind: "member";
      userId: string;
      weddingId: string;
      memberId: string;
      role: "admin" | "manager";
      // This member's own colour theme.
      palette: PaletteId;
    }
  | { kind: "user"; userId: string }
  | { kind: "vendor"; vendorAccountId: string }
  | { kind: "guest"; weddingId: string; guestId: string }
  | { kind: "anonymous" };

export type MemberContext = Extract<Context, { kind: "member" }>;
export type UserContext = Extract<Context, { kind: "user" }>;
export type VendorContext = Extract<Context, { kind: "vendor" }>;
export type GuestContext = Extract<Context, { kind: "guest" }>;

// Members and vendors use separate cookie namespaces; only the member session exists so far.
// The session proves who the account is; the wedding and role come from the weddingMembers
// document, read here on every request. That keeps removals and role changes effective at once
// instead of waiting for a cookie to expire. Guests have no session and resolve through their token.
// Memoised per request, so layouts, pages and actions share one lookup.
export const resolveContext = cache(async (): Promise<Context> => {
  const session = await readSession();
  if (!session) return { kind: "anonymous" };
  const [auth, membership] = await Promise.all([
    getAuthState(session.userId),
    getMembership(session.userId),
  ]);
  // The account was deleted, or its password was reset after this session began.
  if (!auth) return { kind: "anonymous" };
  if (
    auth.sessionsValidAfter &&
    session.issuedAt < Math.floor(auth.sessionsValidAfter.getTime() / 1000)
  ) {
    return { kind: "anonymous" };
  }
  return membership
    ? { kind: "member", userId: session.userId, ...membership }
    : { kind: "user", userId: session.userId };
});

// The vendor portal's own context: a vendor session, in its own cookie, checked against the vendor
// account. A member session never counts here, and this never counts as a member session.
export const resolveVendorContext = cache(async (): Promise<VendorContext | null> => {
  const session = await readVendorSession();
  if (!session) return null;
  const state = await getVendorAuthState(session.userId);
  // The account was deleted, or its password was reset after this session began.
  if (!state) return null;
  if (
    state.sessionsValidAfter &&
    session.issuedAt < Math.floor(state.sessionsValidAfter.getTime() / 1000)
  )
    return null;
  return { kind: "vendor", vendorAccountId: session.userId };
});
