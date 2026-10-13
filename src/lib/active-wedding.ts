import "server-only";
import { cookies } from "next/headers";

// Which of their weddings a person is working in. An account can belong to several; this cookie
// remembers the last one chosen. It is only a preference: it is checked against the account's real
// memberships on every request (lib/context.ts), so a forged or stale value changes nothing.
export const ACTIVE_WEDDING_COOKIE = "mmm_wedding";

export async function readActiveWeddingId(): Promise<string | undefined> {
  const value = (await cookies()).get(ACTIVE_WEDDING_COOKIE)?.value;
  return value && /^[a-f0-9]{24}$/.test(value) ? value : undefined;
}

export async function setActiveWeddingId(weddingId: string): Promise<void> {
  (await cookies()).set(ACTIVE_WEDDING_COOKIE, weddingId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}
