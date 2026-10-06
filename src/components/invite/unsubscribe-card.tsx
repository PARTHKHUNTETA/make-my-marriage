"use client";

import * as React from "react";

// One click, on a page the guest opened from an email. Nothing changes until the button is
// pressed, and it can be undone on the same page.
export function UnsubscribeCard({
  token,
  couple,
  initial,
}: {
  token: string;
  couple: string;
  initial: boolean;
}) {
  const [unsubscribed, setUnsubscribed] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/unsubscribe/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unsubscribe: next }),
      });
      const body = (await response.json()) as { ok: boolean };
      if (body.ok) setUnsubscribed(next);
      else setError("That didn't work. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-6 rounded-2xl bg-white p-6 text-center shadow-[0_1px_3px_rgba(35,31,32,0.06)]">
      <p className="text-[15px] text-ink">
        {unsubscribed
          ? `You won't get reminder emails about ${couple}'s wedding any more.`
          : `Stop reminder emails about ${couple}'s wedding?`}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => change(!unsubscribed)}
        className="mt-4 h-12 w-full rounded-xl bg-bronze text-[15px] font-semibold text-white disabled:opacity-50"
      >
        {busy ? "One moment..." : unsubscribed ? "Undo, send me reminders" : "Unsubscribe"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
