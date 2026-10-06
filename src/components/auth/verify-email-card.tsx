"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, MailCheck } from "lucide-react";
import { AuthCard } from "./auth-card";
import { FormAlert } from "./form-alert";
import { postJson } from "./post-json";
import { SubmitButton } from "./submit-button";

// The emailed link opens this card; the button makes the actual request (see /api/auth/verify).
export function VerifyEmailCard({ token }: { token: string }) {
  const [state, setState] = React.useState<"idle" | "working" | "done" | "invalid" | "error">(
    "idle",
  );
  const [message, setMessage] = React.useState("");

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setState("working");
    const result = await postJson("/api/auth/verify", { token });
    if (result.ok) return setState("done");
    setMessage(result.error.message);
    setState(result.error.code === "LINK_INVALID" ? "invalid" : "error");
  }

  if (state === "done") {
    return (
      <AuthCard title="Email confirmed" subtitle="Thanks, your email address is verified.">
        <div className="flex flex-col gap-4 text-[13px] leading-5 text-ink-2">
          <CheckCircle2 className="size-8 text-forest" aria-hidden />
          <Link
            href="/dashboard"
            className="flex h-11 items-center justify-center rounded-lg bg-bronze text-sm font-semibold text-white shadow-sm transition-all hover:bg-bronze/90"
          >
            Continue to your workspace
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Confirm your email" subtitle="One tap and we'll know it's really you.">
      <form onSubmit={confirm} className="flex flex-col gap-4">
        {state === "invalid" ? (
          <FormAlert title="This link can't be used">
            It has expired or has already been used. Sign in and choose &ldquo;Resend email&rdquo;
            to get a new one.
          </FormAlert>
        ) : null}
        {state === "error" ? (
          <FormAlert title="Couldn't confirm your email">{message}</FormAlert>
        ) : null}
        <MailCheck className="size-8 text-bronze" aria-hidden />
        <SubmitButton pending={state === "working"} pendingLabel="Confirming...">
          Confirm my email
        </SubmitButton>
        <Link
          href="/login"
          className="text-center text-[13px] font-semibold text-plum hover:text-bronze"
        >
          Go to sign in
        </Link>
      </form>
    </AuthCard>
  );
}
