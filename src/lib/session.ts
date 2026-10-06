import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { getAuthEnv } from "@/lib/env";

// Signed, HTTP-only cookie session (system-design §7). The token carries only the user id;
// the wedding and role are looked up per request, so removing a member takes effect at once.
export const SESSION_COOKIE = "mmm_session";

const ISSUER = "makemymarriage";
const AUDIENCE = "member";
const REMEMBERED_SECONDS = 30 * 24 * 60 * 60; // "Remember this device for 30 days"
const SESSION_ONLY_SECONDS = 24 * 60 * 60; // otherwise: cookie dies with the browser, token in a day

// `issuedAt` is in seconds; sessions older than a password reset are rejected (see context.ts).
export type SessionPayload = { userId: string; issuedAt: number };

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthEnv().SESSION_SECRET);
}

// Every call mints a fresh token (new jti and issued-at), so logging in rotates the session.
export async function signSessionToken(userId: string, remember: boolean): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${remember ? REMEMBERED_SECONDS : SESSION_ONLY_SECONDS}s`)
    .sign(secretKey());
}

// Any failure (bad signature, wrong audience, expired, malformed) is simply "no session".
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload.sub && typeof payload.iat === "number"
      ? { userId: payload.sub, issuedAt: payload.iat }
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

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
