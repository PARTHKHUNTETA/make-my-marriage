"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { acceptQuoteAction, cancelBookingAction } from "@/modules/marketplace/actions";

const small = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

// What a couple can do with a request: cancel it while it is open, and accept a quote.
export function BookingActions({
  requestId,
  status,
  quotedAmount,
  quoteLabel,
}: {
  requestId: string;
  status: "sent" | "quoted" | "accepted" | "declined" | "cancelled";
  quotedAmount?: number;
  quoteLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"accept" | "cancel" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(
    action: () => Promise<{ ok: true } | { ok: false; error: { message: string } }>,
  ) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      setConfirm(null);
      router.refresh();
    } else setError(result.error.message);
  }

  if (status !== "sent" && status !== "quoted") return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status === "quoted" && quotedAmount ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm("accept")}
            className={`${small} bg-bronze text-white hover:bg-bronze/90`}
          >
            Accept quote
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirm("cancel")}
          className={`${small} text-destructive hover:bg-destructive/10`}
        >
          Cancel request
        </button>
      </div>
      {confirm === "accept" && quotedAmount ? (
        <div className="flex flex-wrap items-center justify-end gap-2 text-[13px] text-ink-2">
          Accept {quoteLabel}? They&rsquo;ll be added to My Vendors with this as their total cost.
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => acceptQuoteAction({ requestId, amount: quotedAmount }))}
            className={`${small} bg-bronze text-white`}
          >
            {busy ? "Working..." : "Yes, accept"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(null)}
            className={`${small} hover:bg-rose-100`}
          >
            Not yet
          </button>
        </div>
      ) : null}
      {confirm === "cancel" ? (
        <div className="flex flex-wrap items-center justify-end gap-2 text-[13px] text-ink-2">
          Cancel this request?
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => cancelBookingAction({ requestId }))}
            className={`${small} bg-destructive text-white`}
          >
            {busy ? "Working..." : "Yes, cancel"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(null)}
            className={`${small} hover:bg-rose-100`}
          >
            Keep it
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
