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
// account that already has a wedding never sees this (PRD 5.1).
export default async function SetupPage() {
  const ctx = await resolveContext();
  if (ctx.kind === "member") redirect("/dashboard");
  if (ctx.kind !== "user") redirect("/login");
  return (
    <AuthShell>
      <CreateWeddingForm />
    </AuthShell>
  );
}
