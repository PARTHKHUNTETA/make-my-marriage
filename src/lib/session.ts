import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { getAuthEnv } from "@/lib/env";
import { revokeSession } from "@/lib/revoked-sessions";

// Signed, HTTP-only cookie session (system-design §7). The token carries only the user id;
// the wedding and role are looked up per request, so removing a member takes effect at once.
export const SESSION_COOKIE = "mmm_session";
// Vendors have their own login space and cookie, so a vendor session can never open a wedding
// and a member session can never open the vendor portal.
export const VENDOR_SESSION_COOKIE = "mmm_vendor_session";

type Audience = "member" | "vendor";

const ISSUER = "makemymarriage";
const REMEMBERED_SECONDS = 30 * 24 * 60 * 60; // "Remember this device for 30 days"
const SESSION_ONLY_SECONDS = 24 * 60 * 60; // otherwise: cookie dies with the browser, token in a day

// `issuedAt` is in seconds; sessions older than a password reset are rejected (see context.ts).
// `id` names this one token, so signing out can end exactly this session and no other.
export type SessionPayload = { userId: string; issuedAt: number; id?: string; expiresAt?: Date };

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthEnv().SESSION_SECRET);
}

// Every call mints a fresh token (new jti and issued-at), so logging in rotates the session.
export async function signSessionToken(
  userId: string,
  remember: boolean,
  audience: Audience = "member",
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${remember ? REMEMBERED_SECONDS : SESSION_ONLY_SECONDS}s`)
    .sign(secretKey());
}

// Any failure (bad signature, wrong audience, expired, malformed) is simply "no session".
export async function verifySessionToken(
  token: string,
  audience: Audience = "member",
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience,
    });
    return payload.sub && typeof payload.iat === "number"
      ? {
          userId: payload.sub,
          issuedAt: payload.iat,
          id: payload.jti,
          expiresAt: typeof payload.exp === "number" ? new Date(payload.exp * 1000) : undefined,
        }
      : null;
  } catch {
    return null;
  }
}

export async function setSession(userId: string, remember: boolean): Promise<void> {
  const token = await signSessionToken(userId, remember);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Without maxAge the browser drops the cookie when it closes.
    ...(remember ? { maxAge: REMEMBERED_SECONDS } : {}),
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

// Ends the session for good: the token is revoked on the server, then the cookie is removed. The
// cookie goes even if revoking fails, and the failure is still reported, so the person is never
// left looking signed in after pressing Sign out.
async function endSession(cookie: string, audience: Audience): Promise<void> {
  const jar = await cookies();
  const token = jar.get(cookie)?.value;
  try {
    const session = token ? await verifySessionToken(token, audience) : null;
    if (session?.id && session.expiresAt) await revokeSession(session.id, session.expiresAt);
  } finally {
    jar.delete(cookie);
  }
}

export const clearSession = () => endSession(SESSION_COOKIE, "member");

export async function setVendorSession(vendorAccountId: string, remember: boolean): Promise<void> {
  const token = await signSessionToken(vendorAccountId, remember, "vendor");
  (await cookies()).set(VENDOR_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: REMEMBERED_SECONDS } : {}),
  });
}

// The payload's userId is the vendor account id here.
export async function readVendorSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(VENDOR_SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token, "vendor") : null;
}

export const clearVendorSession = () => endSession(VENDOR_SESSION_COOKIE, "vendor");
