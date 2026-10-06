import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password · Make My Marriage",
  robots: { index: false },
};

// The token is a credential: it is only handed to the form, never rendered or logged here.
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <AuthShell>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
