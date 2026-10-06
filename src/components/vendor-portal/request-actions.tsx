"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { declineRequestAction, quoteRequestAction } from "@/modules/marketplace/actions";
import { toRupeeInput } from "@/lib/money";

const small = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

// A vendor answers a request with a price, or declines it.
export function RequestActions({
  requestId,
  quotedAmount,
}: {
  requestId: string;
  quotedAmount?: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState(quotedAmount ? toRupeeInput(quotedAmount) : "");
  const [busy, setBusy] = React.useState(false);
  const [confirmDecline, setConfirmDecline] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run(
    action: () => Promise<
      { ok: true } | { ok: false; error: { message: string; details?: unknown } }
    >,
  ) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      setConfirmDecline(false);
      router.refresh();
      return;
    }
    const details = result.error.details as Record<string, string[] | undefined> | undefined;
    setError(details?.amount?.[0] ?? result.error.message);
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => quoteRequestAction({ requestId, amount }));
        }}
      >
        <label className="sr-only" htmlFor={`quote-${requestId}`}>
          Your price in rupees
        </label>
        <input
          id={`quote-${requestId}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Your price ₹"
          autoComplete="off"
          className="h-9 w-36 rounded-lg border border-line-soft/60 bg-white px-3 text-[13px] text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum"
        />
        <button
          type="submit"
          disabled={busy || !amount.trim()}
          className={`${small} bg-bronze text-white hover:bg-bronze/90`}
        >
          {busy ? "Sending..." : quotedAmount ? "Update quote" : "Send quote"}
        </button>
        {confirmDecline ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => declineRequestAction({ requestId }))}
              className={`${small} bg-destructive text-white`}
            >
              Yes, decline
            </button>
            <button
              type="button"
              onClick={() => setConfirmDecline(false)}
              className={`${small} hover:bg-rose-100`}
            >
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDecline(true)}
            className={`${small} text-destructive hover:bg-destructive/10`}
          >
            Decline
          </button>
        )}
      </form>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
