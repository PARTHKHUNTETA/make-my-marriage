import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailCard } from "@/components/auth/verify-email-card";

export const metadata: Metadata = {
  title: "Confirm your email · Make My Marriage",
  robots: { index: false },
};

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell>
      <VerifyEmailCard token={token} />
    </AuthShell>
  );
}
