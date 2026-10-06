import "server-only";

// Who is calling, resolved once per server entry point before any data is touched
// (system-design §7). weddingId always comes from the session or token, never from input.
export type Context =
  | { kind: "member"; userId: string; weddingId: string; role: "admin" | "manager" }
  | { kind: "vendor"; vendorAccountId: string }
  | { kind: "guest"; weddingId: string; guestId: string }
  | { kind: "anonymous" };

export type MemberContext = Extract<Context, { kind: "member" }>;
export type VendorContext = Extract<Context, { kind: "vendor" }>;
export type GuestContext = Extract<Context, { kind: "guest" }>;

// Phase 1 replaces this with signed-cookie session lookup (members and vendors use
// separate cookie namespaces). Guests have no session; they resolve through their token.
export async function resolveContext(): Promise<Context> {
  return { kind: "anonymous" };
}
