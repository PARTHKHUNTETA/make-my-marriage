import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { resolveContext } from "@/lib/context";
import { safeNext } from "@/lib/safe-next";
import { getProfile } from "@/modules/members/service";

export const metadata: Metadata = { title: "Sign in · Make My Marriage", robots: { index: false } };

// Signed-in visitors go straight to the app. The profile check avoids a redirect loop when a
// cookie outlives its account: the app sends such visitors here, and this page then shows the form.
async function hasLiveSession(): Promise<boolean> {
  try {
    const ctx = await resolveContext();
    if (ctx.kind !== "user" && ctx.kind !== "member") return false;
    return (await getProfile(ctx.userId)) !== null;
  } catch {
    return false;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await hasLiveSession()) redirect(next);
  return (
    <AuthShell>
      <LoginForm next={next} />
    </AuthShell>
  );
}
