import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { resolveContext } from "@/lib/context";
import { getProfile } from "@/modules/members/service";

export const metadata: Metadata = {
  title: "Create your workspace · Make My Marriage",
  robots: { index: false },
};

async function hasLiveSession(): Promise<boolean> {
  try {
    const ctx = await resolveContext();
    if (ctx.kind !== "user" && ctx.kind !== "member") return false;
    return (await getProfile(ctx.userId)) !== null;
  } catch {
    return false;
  }
}

export default async function SignupPage() {
  if (await hasLiveSession()) redirect("/dashboard");
  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  );
}
