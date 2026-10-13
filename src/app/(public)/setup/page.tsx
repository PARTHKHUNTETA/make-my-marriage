import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { CreateWeddingForm } from "@/components/wedding/create-wedding-form";
import { resolveContext } from "@/lib/context";

export const metadata: Metadata = {
  title: "Set up your wedding · Make My Marriage",
  robots: { index: false },
};

// First-time setup, shown between sign-up and the dashboard. Signed out goes to sign-in; an
// account that already has a wedding sees this only when starting another one (?new=1).
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const ctx = await resolveContext();
  // Someone who already has a wedding only comes here on purpose, to start another.
  const another = (await searchParams).new === "1";
  if (ctx.kind === "member" && !another) redirect("/dashboard");
  if (ctx.kind !== "user" && ctx.kind !== "member") redirect("/login");
  return (
    <AuthShell>
      <CreateWeddingForm />
    </AuthShell>
  );
}
