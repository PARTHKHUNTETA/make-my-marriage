"use client";

import * as React from "react";
import { MailWarning } from "lucide-react";
import { postJson } from "@/components/auth/post-json";

// Shown to accounts that have not confirmed their email yet. They can keep working.
export function VerifyEmailBanner({
  email,
  endpoint = "/api/auth/resend-verification",
}: {
  email: string;
  endpoint?: string;
}) {
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = React.useState("");

  async function resend() {
    setState("sending");
    const result = await postJson(endpoint, {});
    if (result.ok) return setState("sent");
    setMessage(result.error.message);
    setState("error");
  }

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-2 rounded-xl border border-honey bg-honey/30 px-4 py-3 text-[13px] text-amber-deep sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-center gap-2">
        <MailWarning className="size-4 shrink-0" aria-hidden />
        {state === "sent"
          ? `We've sent a new link to ${email}.`
          : state === "error"
            ? message
            : `Please confirm your email address. We sent a link to ${email}.`}
      </span>
      {state === "sent" ? null : (
        <button
          type="button"
          onClick={resend}
          disabled={state === "sending"}
          className="self-start rounded-lg bg-white px-3 py-1 text-xs font-semibold text-plum shadow-hair transition-colors hover:bg-rose-50 disabled:opacity-60 sm:self-auto"
        >
          {state === "sending" ? "Sending..." : "Resend email"}
        </button>
      )}
    </div>
  );
}
